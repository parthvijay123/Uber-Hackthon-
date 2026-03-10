# Driver Pulse

## Overview

Driver Pulse is a system that processes raw driver trip and sensor data to detect unsafe driving events and generate insights about driver behavior. The system identifies events such as harsh braking  and produces structured logs for analysis.

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

## Documented Trade-offs


## Links to Live Deployment and Live Demo


## Contributors

* Yash Mittal
* Kiranpreet Kaur
* Parth Vijay
