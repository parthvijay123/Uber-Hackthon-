import pandas as pd
import numpy as np
import os

def simulate_accelerometer_stream(input_file, output_file):
    """
    Simulates a cloud ingestion engine receiving data in 15-second buffers.
    Detects harsh braking and rapid acceleration inside each window.
    """
    print("Initializing Accelerometer Stream Simulator...")
    
    # 1. Load the pre-cleaned data (simulating the data that arrived from the Edge)
    try:
        df = pd.read_csv(input_file)
        # Ensure timestamp is a datetime object for windowing
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    except FileNotFoundError:
        print(f"Error: {input_file} not found. Run preprocessor_accelerometer.py first.")
        return

    # List to hold the flagged events we discover
    detected_events = []

    # Get a list of all unique trips to simulate them one by one
    trips = df['trip_id'].unique()
    print(f"Simulating streams for {len(trips)} unique trips...\n")

    WINDOW_SECONDS = 15
    
    # --- THRESHOLDS (These are heuristic rules for the hackathon) ---
    # Horizontal magnitude > 2.2 indicates significant force
    # Horizontal magnitude > 5.0 indicates an extreme, instantaneous force (Collision)
    # If speed drops (delta_speed < -3.0), it's a harsh brake.
    # If speed jumps (delta_speed > 3.0), it's a harsh acceleration.
    MAGNITUDE_THRESHOLD = 2.2
    COLLISION_THRESHOLD = 5.0
    SPEED_DROP_THRESHOLD = -3.0
    SPEED_JUMP_THRESHOLD = 3.0

    for trip in trips:
        # Isolate the data for just this trip
        trip_data = df[df['trip_id'] == trip].copy()
        
        # Sort chronologically just in case the network scrambled the packets
        trip_data = trip_data.sort_values(by='timestamp')
        
        # Determine the start and end of the trip
        if trip_data.empty:
            continue
            
        trip_start = trip_data['timestamp'].min()
        trip_end = trip_data['timestamp'].max()
        
        # 2. START THE SLIDING WINDOW (The Buffer Simulator)
        current_window_start = trip_start
        
        while current_window_start <= trip_end:
            current_window_end = current_window_start + pd.Timedelta(seconds=WINDOW_SECONDS)
            
            # Extract the 15 seconds of data for this specific buffer
            buffer_mask = (trip_data['timestamp'] >= current_window_start) & (trip_data['timestamp'] < current_window_end)
            buffer_df = trip_data[buffer_mask]
            
            if not buffer_df.empty:
                # --- APPLY HEURISTICS TO THE BUFFER ---
                
                # Check for Collision (Massive force, ignoring speed change)
                collision_events = buffer_df[(buffer_df['horizontal_magnitude'] >= COLLISION_THRESHOLD)]
                
                if not collision_events.empty:
                    event_time = collision_events.iloc[0]['timestamp']
                    detected_events.append({
                        'trip_id': trip,
                        'timestamp': event_time,
                        'event_type': 'Collision / Severe Impact',
                        'magnitude': round(collision_events.iloc[0]['horizontal_magnitude'], 2)
                    })
                    print(f"[{trip}] 💥 COLLISION DETECTED at {event_time.strftime('%H:%M:%S')}")

                # Check for Harsh Braking (High force + Negative speed change)
                braking_events = buffer_df[(buffer_df['horizontal_magnitude'] >= MAGNITUDE_THRESHOLD) & 
                                           (buffer_df['horizontal_magnitude'] < COLLISION_THRESHOLD) & # Prevent double-flagging
                                           (buffer_df['delta_speed'] <= SPEED_DROP_THRESHOLD)]
                
                if not braking_events.empty:
                    # We found a harsh brake! Log the event using the exact timestamp it occurred
                    event_time = braking_events.iloc[0]['timestamp'] # Grab the first spike in the window
                    detected_events.append({
                        'trip_id': trip,
                        'timestamp': event_time,
                        'event_type': 'Harsh Braking',
                        'magnitude': round(braking_events.iloc[0]['horizontal_magnitude'], 2)
                    })
                    print(f"[{trip}] 🚨 Harsh Brake Detected at {event_time.strftime('%H:%M:%S')}")
                
                # Check for Rapid Acceleration (High force + Positive speed change)
                accel_events = buffer_df[(buffer_df['horizontal_magnitude'] >= MAGNITUDE_THRESHOLD) & 
                                         (buffer_df['horizontal_magnitude'] < COLLISION_THRESHOLD) & # Prevent double-flagging
                                         (buffer_df['delta_speed'] >= SPEED_JUMP_THRESHOLD)]
                
                if not accel_events.empty:
                    event_time = accel_events.iloc[0]['timestamp']
                    detected_events.append({
                        'trip_id': trip,
                        'timestamp': event_time,
                        'event_type': 'Rapid Acceleration',
                        'magnitude': round(accel_events.iloc[0]['horizontal_magnitude'], 2)
                    })
                    print(f"[{trip}] 🏎️ Rapid Acceleration Detected at {event_time.strftime('%H:%M:%S')}")

            # Slide the window forward by 15 seconds
            current_window_start = current_window_end

    # 3. Save the aggregated flags to a new output file
    if detected_events:
        events_df = pd.DataFrame(detected_events)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        events_df.to_csv(output_file, index=False)
        print(f"\n✅ Simulation Complete. {len(detected_events)} total events flagged.")
        print(f"Saved flagged events to: {output_file}")
    else:
        print("\n✅ Simulation Complete. No critical events detected in any trip.")

if __name__ == "__main__":
    # Input: The clean accelerometer file we generated in Phase 2
    INPUT_FILE = 'processed_outputs/clean_accelerometer.csv'
    # Output: A new file just for these specific motion flags
    OUTPUT_FILE = 'processed_outputs/accelerometer_flags.csv'
    
    simulate_accelerometer_stream(INPUT_FILE, OUTPUT_FILE)
