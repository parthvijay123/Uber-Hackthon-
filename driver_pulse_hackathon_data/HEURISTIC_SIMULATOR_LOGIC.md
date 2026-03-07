# The Pulse Heuristic Engine

This document explains the architectural approach and the specific algorithmic logic used to detect critical driving events (Harsh Braking, Rapid Acceleration, Collisions) from the preprocessed sensor data.

## 1. The Streaming Architecture (15-Second Windows)

In a real-world telematics platform, the Cloud backend does not wait for an entire CSV file to finish downloading before it begins analyzing the data. It processes the incoming data stream in real-time batches. 

To simulate this enterprise architecture, we did not write a simple Pandas script to search the whole file at once. Instead, we built a **Sliding Window Stream Simulator** (`simulator_accelerometer.py`).

### How the Simulator Works:
1.  **The Tick:** The simulator starts at the chronological beginning of a driver's trip.
2.  **The Window (Buffer):** It pulls exactly **15 seconds** of sensor data into memory at a time (e.g., `06:45:00` to `06:45:15`).
3.  **The Analysis:** The Heuristic Engine evaluates *only* this isolated 15-second buffer.
4.  **The Slide:** Once evaluated, the window slides forward by 15 seconds, and the process repeats until the trip concludes.

**Why did we build it this way?**
This proves to the judges that our logic is deployable in a real-time Message Queue environment (like Kafka), where data arrives in payload chunks rather than complete, perfect historical files.

---

## 2. Motion Heuristic Rules (Physics Logic)

Within each 15-second buffer, the engine looks for specific physical signatures using the `horizontal_magnitude` (calculating total G-force) and `delta_speed` (contextual speed changes) that we generated during Phase 2.

### A. Collision / Severe Impact
*   **The Rule:** `horizontal_magnitude >= 5.0`
*   **The Rationale:** A magnitude of 5.0 indicates an extreme, instantaneous physical force applied to the phone (equivalent to >50 m/s²). Because this force is so massive, we do not even check the GPS speed. If the accelerometer registers this level of violence, it is immediately flagged as a Severe Impact or Collision.

### B. Harsh Braking
*   **The Rule:** `horizontal_magnitude >= 2.2` AND `delta_speed <= -3.0`
*   **The Rationale:** A magnitude above 2.2 indicates a significant physical jolt. However, a jolt alone could just be a speed bump. To confirm it was a *driving maneuver*, we cross-reference the GPS. If the physical jolt occurred exactly when the vehicle's speed dropped by more than 3 km/h in a fraction of a second, the system confidently flags a **Harsh Braking** event.

### C. Rapid Acceleration
*   **The Rule:** `horizontal_magnitude >= 2.2` AND `delta_speed >= 3.0`
*   **The Rationale:** Similar to braking, the engine looks for a significant physical force (`> 2.2`). If that force aligns perfectly with a sudden *increase* in GPS speed (`> 3.0`), the system flags an aggressive, **Rapid Acceleration** (e.g., peeling out of a parking lot or aggressively passing another car).

## 3. Audio Heuristic Rules (Environmental Logic)

Script: `simulator_audio.py`

Unlike motion data where a split-second spike (a massive collision) tells a full story, audio is highly environmental. A single 0.5-second spike of 90dB might just be a driver sneezing, clearing their throat, or shutting a car door. Flagging a sneeze as "High Tension" would create a terrible user experience.

### A. Sustained Loud Noise
*   **The Rule:** The **AVERAGE** audio level across the entire 15-second buffer must be `>= 80.0 dB`. 
*   **The Rationale:** Normal cabin conversation sits at ~60dB. 80dB is equivalent to yelling, honking, or aggressive music. By requiring the *average* of the entire rolling 15-second window to hit 80dB, our logic effectively ignores the 1-second sneezes entirely. It only flags sustained, ongoing loud events. 

---

### Flag Deduplication (Windowed Emitting)
To prevent the system from penalizing a driver multiple times for the exact same event, the logic is strictly bucketed by the 15-second windows. The simulator ensures that a single 10-second braking event crossing a buffer boundary does not falsely trigger five rapid, overlapping alerts. It cleanly emits exactly one flag per maneuver/incident detected in that time span.
