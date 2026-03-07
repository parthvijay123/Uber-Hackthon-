# Driver Pulse: Edge Ingestion & Preprocessing Architecture

## 1. The Challenge of Real-World Data

When designing the Driver Pulse system, we recognized early on that real-world telematics pipelines suffer from severe syncing and hardware issues. If we simply trusted the raw telemetry payloads arriving at the cloud, our Heuristic Engine would flag thousands of false positives. 

Specifically, we identified three major failure points that our architecture needed to solve before any "stress detection" occurred:
- **Dropped Connectivity:** If a phone loses signal (e.g., in a tunnel or underground parking), the start/end trip signals might be delayed or misordered when finally uploaded.
- **Hardware Noise:** Accelerometers pick up every minor engine vibration, pothole, and phone drop.
- **Privacy Overreach:** The app might accidentally continue recording environmental data after the passenger has been dropped off and the trip has technically concluded.

### Exposing Flaws in the Operational Data 
During our initial data exploration of `trips.csv`, we found that the reported `end_time` is frequently corrupted or delayed. For example: `TRIP022` started at `16:34:00` and lasted `27` minutes, but the logged `end_time` was `16:01:00`. If we had trusted the given `end_time`, we would have either dropped perfectly valid driver data or incorrectly included irrelevant sensor readings from a completely different hour of the day.

We built two preprocessor modules (`preprocessor_accelerometer.py` and `preprocessor_audio.py`) to simulate the strict data-sanitization boundary between the Edge Device (phone) and the Cloud Endpoint.

---

## 2. Preprocessing Logic: Motion Signals

Script: `preprocessor_accelerometer.py`

### A. Strict Temporal Synchronization
To solve the corrupted timestamps issue, we programmed our pipeline to ignore the faulty `end_time` column entirely. Instead, our script calculates the `true_end` timestamp computationally by adding the `duration_min` directly to the reliable `start_time`. 
We scan the high-frequency accelerometer stream and firmly **reject** any rows occurring outside this true trip window. This guarantees we are never analyzing data collected when the phone was just sitting in the driver's pocket at a restaurant after their shift.

### B. Hardware Malfunction Filter
A standard smartphone accelerometer hardware caps out around 2G to 8G (20 to 80 m/s²). If our ingestion layer sees an isolated reading of 100G (980 m/s²), we know that isn't a car crash; that's underlying hardware corruption or a dropped phone. We implemented strict boundary filters to discard these physical impossibilities before they ruin our rolling averages.

### C. Low-Pass Smoothing (Simulating Edge Processing)
The accelerometer inside the phone is incredibly sensitive and records erratic, jagged data from everyday driving (e.g., engine rumble, hitting small potholes). Before the Heuristic Engine touches the data, we need to mathematically "iron out" these micro-vibrations using a Low-Pass Filter. This prevents the system from wasting backend compute or accidentally triggering a false crash alert every time the car hits a cobblestone street.

We implemented this by applying a rolling average `(window=3)` across the XYZ vectors. This algorithmic filter makes the system "squint" at the data, ignoring tiny blips and isolating only significant, sustained macro-movements (like a harsh brake or an aggressive swerve).

**Example of the Filter in Action:**
If the car hits a sharp pothole, three consecutive forward-motion readings occurring in a fraction of a second might look like: `[2.0, 9.5, 2.1]`. Without smoothing, the heuristic logic might see that `9.5` spike and falsely trigger a "Crash" alert. Our rolling average adds them together and divides by 3 to get a smoothed value of `4.5`—safely ignoring the momentary pothole. 
Conversely, a genuine harsh braking event would produce sustained high readings like `[8.0, 8.2, 7.9]`. This rolling average remains a high `8.03`, preserving the data shape and correctly triggering the safety alert.

### D. Edge Feature Engineering: The Phone Orientation Problem
During our initial system design, we ran into a massive real-world edge case: **How do we know which way the driver's phone is pointing?** 

If a phone is perfectly mounted flat against the dashboard facing the windshield:
*   The **Y-axis** measures forward/backward force (acceleration/braking).
*   The **X-axis** measures left/right force (swerving/cornering).
*   The **Z-axis** measures up/down force (gravity and potholes).

**The Problem:** Rideshare drivers DO NOT mount their phones perfectly. The phone might be tilted on an AC vent mount, resting diagonally inside a cup holder, or deliberately turned sideways for landscape-mode GPS routing. Because we don't know the exact physical orientation of the phone inside the car, we cannot strictly guarantee that the X-axis is always measuring side-to-side force and the Y-axis is always measuring braking. If we simply hardcoded a rule that stated *"Harsh Braking = Y-axis drops by -4.0 m/s²"*, our entire Heuristic Engine would fail the moment a driver rotated their phone, because suddenly that force would be recorded on the X-axis instead!

**Our Engineered Solution (Horizontal Magnitude):**
To solve this, we strategically modeled our pipeline to **never decide which axis is "correct"**. Instead, we programmed the edge ingestion script to instantly combine the two horizontal planes into a single, directionless force metric using the Pythagorean theorem (`c = √(a² + b²)`):

```python
clean_df['horizontal_magnitude'] = np.sqrt(clean_df['accel_x']**2 + clean_df['accel_y']**2)
```

By squaring the X and Y coordinates and taking the square root, we calculate the *total amount of flat horizontal energy* being applied to the phone, entirely regardless of which direction the phone is pointing. Whether the phone is facing perfectly forward or twisted 45 degrees in a cup holder, a massive jolt of physical energy (like slamming on the brakes) will unambiguously result in a high `horizontal_magnitude`. (We intentionally ignore the Z-axis in this calculation to avoid flagging speed bumps or the constant 9.8 m/s² pull of gravity).

**Fusing Features for Context (Delta Speed):**
If `horizontal_magnitude` is just a single positive number representing "a lot of movement," the Cloud Engine still needs to distinguish if the car violently sped up or violently slowed down. 

To give our Heuristic Engine the necessary context without relying on raw spatial vectors, we cross-reference the motion with the GPS tracker to calculate a secondary edge feature: `delta_speed` (the change in GPS speed between intervals). Thus, by preprocessing raw XYZ coordinates into a robust `horizontal_magnitude` and contextual `delta_speed` vector directly during ingestion, our system is completely immune to however the driver decides to mount their device in the cabin.

---

## 3. Preprocessing Logic: Audio Intensity 

Script: `preprocessor_audio.py`

### A. The Privacy Guarantee
The most critical design decision we made was that **raw audio must never leave the driver's device.** Our ingestion script does not touch `.wav` or `.mp3` files. The phone's local audio engine securely calculates decibels on the fly and immediately destroys the active recording. Our cloud pipeline strictly ingests numerical `audio_level_db` arrays.

### B. Range Validation Rules
Normal cabin conversation sits around ~60dB, while a loud argument might hit ~85dB. We built validation logic to drop any corrupted readings that fall below 0dB (a physical impossibility) or above 150dB (the equivalent of a jet engine inside the cabin).

### C. Temporal Overreach Scrubbing 
Just like the motion data, we strictly enforce the `true_start` and `true_end` trip boundaries calculated from the operational data. If the driver's app accidentally continued logging the microphone level while they were off-duty, that data is completely scrubbed from the system before any analysis occurs, ensuring total off-duty privacy.
