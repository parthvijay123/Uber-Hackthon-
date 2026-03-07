import pandas as pd
import os

def simulate_audio_stream(input_file, output_file):
    """
    Simulates a cloud ingestion engine receiving audio data in 15-second buffers.
    Detects sustained high-decibel events (indicative of arguments or high stress).
    """
    print("Initializing Audio Stream Simulator...")
    
    try:
        df = pd.read_csv(input_file)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    except FileNotFoundError:
        print(f"Error: {input_file} not found. Run preprocessor_audio.py first.")
        return

    detected_events = []
    trips = df['trip_id'].unique()
    print(f"Simulating streams for {len(trips)} unique trips...\n")

    WINDOW_SECONDS = 15
    
    # --- THRESHOLDS (Audio Heuristics) ---
    # Normal conversation is ~60dB. 
    # Sustained noise above 80dB in a car cabin is very loud (yelling, honking, aggressive music).
    # We require the AVERAGE of the 15-second buffer to be above the threshold to filter out a single loud sneeze or door slam.
    LOUD_AUDIO_THRESHOLD = 80.0

    for trip in trips:
        trip_data = df[df['trip_id'] == trip].copy()
        trip_data = trip_data.sort_values(by='timestamp')
        
        if trip_data.empty:
            continue
            
        trip_start = trip_data['timestamp'].min()
        trip_end = trip_data['timestamp'].max()
        
        current_window_start = trip_start
        
        while current_window_start <= trip_end:
            current_window_end = current_window_start + pd.Timedelta(seconds=WINDOW_SECONDS)
            
            # Extract 15 seconds of audio data
            buffer_mask = (trip_data['timestamp'] >= current_window_start) & (trip_data['timestamp'] < current_window_end)
            buffer_df = trip_data[buffer_mask]
            
            if not buffer_df.empty:
                # Calculate the average decibel level over this 15-second window
                buffer_avg_db = buffer_df['audio_level_db'].mean()
                
                if buffer_avg_db >= LOUD_AUDIO_THRESHOLD:
                    # We found a sustained loud noise event in this buffer
                    event_time = buffer_df.iloc[0]['timestamp']
                    detected_events.append({
                        'trip_id': trip,
                        'timestamp': event_time,
                        'event_type': 'Sustained Loud Noise',
                        'magnitude': round(buffer_avg_db, 2)
                    })
                    print(f"[{trip}] 🔊 Sustained Loud Noise ({round(buffer_avg_db, 1)}dB) Detected at {event_time.strftime('%H:%M:%S')}")

            # Slide window forward
            current_window_start = current_window_end

    if detected_events:
        events_df = pd.DataFrame(detected_events)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        events_df.to_csv(output_file, index=False)
        print(f"\nSimulation Complete. {len(detected_events)} total audio events flagged.")
        print(f"Saved flagged events to: {output_file}")
    else:
        print("\nSimulation Complete. No critical audio events detected in any trip.")

if __name__ == "__main__":
    INPUT_FILE = 'processed_outputs/clean_audio.csv'
    OUTPUT_FILE = 'processed_outputs/audio_flags.csv'
    simulate_audio_stream(INPUT_FILE, OUTPUT_FILE)
