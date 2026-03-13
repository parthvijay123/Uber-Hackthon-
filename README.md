# Driver Pulse

## Overview

Driver Pulse is a system that processes raw driver trip and sensor data to detect unsafe driving events and generate insights about driver behavior. The system identifies events such as harsh braking  and produces structured logs for analysis.

## Setup

### 1. Clone the repository

⁠ bash
git clone https://github.com/parthvijay123/Uber-Hackthon-
cd Uber-Hackthon-
 ⁠

### 2. Install frontend dependencies

⁠ bash
cd client
npm install
 ⁠

### 3. Install backend dependencies

⁠ bash
cd ../server
npm install
 ⁠

### 4. (Optional) Install Python dependencies for data preprocessing

If you plan to run the preprocessing or simulation scripts inside ⁠ driver_pulse_hackathon_data/ ⁠, make sure Python 3 is installed.

You can install Python packages using:

⁠ bash
pip3 install pandas numpy
 ⁠

(Only required if you run the Python preprocessing scripts.)

### 5. Initialize database and start the backend server

Run the setup script to create the database, tables, and seed the required minimal data:

⁠ bash
cd server
npm run setup

Then start the server:

⁠ bash
npm run dev
 ⁠

### 6. Start the frontend application

Open a new terminal and run:

⁠ bash
cd client
npm run dev
 ⁠

### 7. Open the application

The frontend will typically be available at:


http://localhost:5173


Open the URL in your browser to access the web dashboard.


## Documented Trade-offs

### 1. Real-Time Processing vs. Real-Time Display

The system prioritizes real-time processing to maintain temporal accuracy while strictly enforcing a no real-time display policy to ensure driver safety.

•⁠  ⁠Temporal Correlation

  Processing must occur in real time because the correlation signal between audio and motion decays rapidly.  
  For example, a passenger argument followed by a harsh brake within 10 seconds is a meaningful co-occurrence that would be lost if processed an hour later.

•⁠  ⁠Zero-Distraction Constraint

  To adhere to a non-negotiable zero-distraction constraint, drivers must not see any system output during the trip.

•⁠  ⁠Safety Hazard Mitigation

  Showing a flag notification while a driver is at high speeds (e.g., 80 km/h*) is considered a safety hazard that would defeat the purpose of the system.

  Therefore, processing runs live, but output is held until the trip ends.



### 2. Store-and-Forward Pipeline

The system uses a local-first architecture to ensure zero data loss during network instability.

•⁠  ⁠Immediate Local Persistence

  Every ⁠ FlagEvent ⁠ is written to a local MySQL database immediately upon generation with:

  
⁠   upload_status = PENDING
   ⁠

•⁠  ⁠Decoupled Network State

  Local writes occur regardless of network state, ensuring the network is never in the critical path of event capture.

•⁠  ⁠Upload Priority

  When connectivity returns, the ⁠ UploadManager ⁠ reads all ⁠ PENDING ⁠ rows ordered by:

  
⁠   combined_score DESC
   ⁠

  This ensures high-severity flags are uploaded to the cloud first.



### 3. CAP Theorem Position: AP

This system is classified as AP (Available and Partition Tolerant).

•⁠  ⁠Edge Independence

  During a network partition, the edge device continues:

  - sampling
  - processing
  - storing data locally

•⁠  ⁠Eventual Consistency

  The cloud receives events once connectivity is restored.

•⁠  ⁠High Availability

  The driver’s post-trip summary is served from the local MySQL store, making it always available even if the ⁠ UploadManager ⁠ has not yet drained the queue.



### 4. Idempotent Writes

Because the system may reprocess data frequently (especially in demo mode), all MySQL writes are designed to be idempotent.

Implementation


INSERT IGNORE


or


ON DUPLICATE KEY UPDATE


Applied to Tables

•⁠  ⁠⁠ motion_events ⁠
•⁠  ⁠⁠ audio_events ⁠
•⁠  ⁠⁠ flag_events ⁠
•⁠  ⁠⁠ earnings_velocity_log ⁠
•⁠  ⁠⁠ trip_summaries ⁠

This prevents duplicate rows from being created during reprocessing.



### 5. Simulated vs Production-Ready Components

The demo environment uses CSV files as input sources, but the downstream architecture and logic remain identical to production.

| Feature | Simulated (Demo) | Production Implementation |
|--------|-----------------|--------------------------|
| *Accelerometer* | CSV data | ⁠ SensorEventListener ⁠ at 50 Hz |
| *Microphone* | CSV data | ⁠ AudioRecord ⁠ → FFT → dB |
| *Local Storage* | SQLite + AES-256 | SQLCipher |
| *Logic Engines* | — | ⁠ MotionProcessor ⁠, ⁠ AudioSpikeTracker ⁠, ⁠ FusionEvaluator ⁠ |
| *Data Management* | — | ⁠ FlagWriter ⁠ (idempotent), ⁠ UploadManager ⁠ (exponential backoff) |
| *Analytics* | — | Post-trip velocity pipeline and upload state machine |



This separation allows realistic demonstrations without requiring live sensors, while keeping the core architecture production-ready.
## Links to Live Deployment and Live Demo

https://drive.google.com/drive/folders/1EMuYCGrZMq6FU1eAfFlinuo2k1y4zIgu?usp=sharing

https://uber-hackthon-dm6d.vercel.app/


## Contributors

•⁠  ⁠Yash Mittal
•⁠  ⁠Kiranpreet Kaur
•⁠  ⁠Parth Vijay


