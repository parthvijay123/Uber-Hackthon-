# Driver Pulse Project Plan

This document outlines the step-by-step implementation plan for the Driver Pulse hackathon, focusing on real-world constraints like edge computing, privacy, and connectivity.

## Phase 1: Architectural Design & Documentation
- [ ] Draft `DESIGN.md` focusing on Edge vs. Cloud architecture.
- [ ] Detail audio privacy strategy (on-device dB processing, no raw audio storage).
- [ ] Explain the "store and forward" data syncing model for low connectivity scenarios.
- [ ] Document the zero-distraction policy (post-trip dashboard updates only).
- [ ] Create a Mermaid.js architecture diagram mapping data flow from edge to cloud.

## Phase 2: Data Ingestion & Preprocessing (The Edge Simulation)
- [ ] Create `data_preprocessor.py` to ingest raw CSVs (simulating data arriving at the cloud).
- [ ] Implement timestamp correction logic for operational data (`trips.csv`).
- [ ] Handle missing or noisy data points in sensor data (simulating dropped packets/sensor noise).
- [ ] Align timestamps between `accelerometer_data.csv` and `audio_intensity_data.csv` for combined analysis.

## Phase 3: The "Pulse" Detection Engine (Cloud Processing)
- [ ] Create `stress_detector.py` for core heuristic logic.
- [ ] **Motion Rules**: Implement logic for harsh braking, rapid acceleration, and crashes using acceleration magnitude and `delta_speed` thresholds.
- [ ] **Audio Rules**: Implement rolling window logic (e.g., 5 seconds) to detect sustained spikes in audio intensity, filtering instant noises.
- [ ] **Signal Fusion**: Create the intersection logic (e.g., harsh brake + sustained audio spike = "High Tension Incident").
- [ ] Generate structured `flagged_moments.csv` output linking timestamps, triggers, and raw signals.

## Phase 4: Earnings Velocity Forecaster
- [ ] Create `earnings_engine.py` to process `driver_goals.csv` and `earnings_velocity_log.csv`.
- [ ] Calculate current Earnings Per Hour (EPH) leading up to the most recent trip.
- [ ] Calculate remaining time in the typical shift.
- [ ] Project whether the driver will meet their daily goal based on current pacing.
- [ ] Generate standard statuses (e.g., "On Track", "Pacing Behind").

## Phase 5: Post-Trip Driver Dashboard (The Output Interface)
- [ ] Define the technical approach for the prototype interface (e.g., static HTML/JS dashboard simulating the Driver App after a trip).
- [ ] Implement a timeline/map view showing where "tension" moments occurred.
- [ ] Display clear, explainable reasons for flags (e.g., "Heavy braking + loud cabin noise").
- [ ] Implement the financial progress bar showing Earnings Velocity and goal status.

## Phase 6: Final Hardening & Engineering Handoff
- [ ] Compile a comprehensive `README.md` with setup instructions and engineering handoff details.
- [ ] Maintain the `PROGRESS_LOG.md` detailing development history and technical pivots.
- [ ] Complete the final `trip_summaries.csv` expected output.
- [ ] Review all code for modularity, cleanliness, and comments explaining trade-offs.
