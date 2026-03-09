# Driver Pulse

## Overview

Driver Pulse is a system that processes raw driver trip and sensor data to detect unsafe driving events and generate insights about driver behavior. The system identifies events such as harsh braking  and produces structured logs for analysis.

## Features

* Detect harsh braking events
* Detect harsh turning events
* Generate structured event logs
* Process trip sensor data efficiently

## System Architecture

The system processes data through the following pipeline:

Raw Sensor Data
↓
Data Processing
↓
Event Detection Engine
↓
Structured Logs and Insights

## Project Structure

```
## Project Structure

Driver_pulse/
│
├── client/                         # Frontend web application (Vite + TypeScript)
│   ├── src/                        # Frontend source code
│   ├── dist/                       # Production build output
│   ├── index.html                  # Main HTML entry point
│   ├── package.json                # Frontend dependencies
│   └── vite.config.ts              # Vite configuration
│
├── server/                         # Backend API server
│   ├── src/                        # Server source code
│   ├── package.json                # Backend dependencies
│   └── tsconfig.json               # TypeScript configuration
│
├── shared/                         # Shared types between client and server
│   └── types.ts
│
├── driver_pulse_hackathon_data/    # Data processing and simulation logic
│   ├── sensor_data/                # Raw sensor inputs
│   ├── processed_outputs/          # Processed data outputs
│   ├── drivers/                    # Driver-related data
│   ├── earnings/                   # Earnings data
│   ├── trips/                      # Trip-level data
│   │
│   ├── preprocessor_audio.py
│   ├── preprocessor_accelerometer.py
│   ├── simulator_audio.py
│   ├── simulator_accelerometer.py
│   │
│   ├── preprocessing_logic.md
│   ├── HEURISTIC_SIMULATOR_LOGIC.md
│   └── DESIGN.md
│
└── README.md
```

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/parthvijay123/Uber-Hackthon-
cd Uber-Hackthon-
```

### 2. Install frontend dependencies

```bash
cd client
npm install
```

### 3. Install backend dependencies

```bash
cd ../server
npm install
```

### 4. (Optional) Install Python dependencies for data preprocessing

If you plan to run the preprocessing or simulation scripts inside `driver_pulse_hackathon_data/`, make sure Python 3 is installed.

You can install Python packages using:

```bash
pip3 install pandas numpy
```

*(Only required if you run the Python preprocessing scripts.)*

### 5. Start the backend server

```bash
cd server
npm run dev
```

### 6. Start the frontend application

Open a new terminal and run:

```bash
cd client
npm run dev
```

### 7. Open the application

The frontend will typically be available at:

```
http://localhost:5173
```

Open the URL in your browser to access the web dashboard.

## Usage

Place input trip or sensor data inside the `data/` directory and run the program.
The system will process the data and output detected driving events.

## Output

The system generates structured logs in the `logs/` directory.

Example log entry:

```
{
  "timestamp": "2026-03-09T14:05:22",
  "driver_id": "D102",
  "event": "harsh_brake",
  "acceleration": -4.2
}
```

## Design Decisions

* Threshold-based detection is used for identifying harsh driving events.
* Structured logs are generated to maintain transparency of system decisions.

## Future Improvements

* Machine learning based event detection
* Real-time data streaming
* Driver analytics dashboard

## Contributors

* Yash Mittal
* Kiranpreet Kaur
* Parth Vijay
