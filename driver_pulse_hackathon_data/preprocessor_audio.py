import pandas as pd

def preprocess_audio(sensor_file, trips_file, output_file):
    print("Loading raw audio files...")
    audio_df = pd.read_csv(sensor_file, parse_dates=['timestamp'])
    trips_df = pd.read_csv(trips_file)

    # Rebuild true timestamps due to potentially corrupted end_times in trips.csv
    trips_df['true_start'] = pd.to_datetime(trips_df['date'] + ' ' + trips_df['start_time'])
    trips_df['true_end'] = trips_df['true_start'] + pd.to_timedelta(trips_df['duration_min'], unit='m')

    # Merge to establish boundaries
    merged_df = audio_df.merge(
        trips_df[['trip_id', 'driver_id', 'true_start', 'true_end']], 
        on='trip_id', 
        how='left'
    )
    initial_count = len(merged_df)

    # 1. Edge Sync Simulation: Filter out data outside trip bounds
    # The phone shouldn't be recording audio intensity when the driver isn't on an active trip.
    clean_df = merged_df[
        (merged_df['timestamp'] >= merged_df['true_start']) & 
        (merged_df['timestamp'] <= merged_df['true_end'])
    ].copy()
    
    post_time_filter = len(clean_df)

    # 2. Filter invalid audio readings
    # A standard cabin environment cannot have negative decibels or impossibly loud > 200dB
    clean_df.dropna(subset=['audio_level_db'], inplace=True)
    valid_db_filter = (clean_df['audio_level_db'] > 0) & (clean_df['audio_level_db'] < 150)
    clean_df = clean_df[valid_db_filter]
    
    post_validity_filter = len(clean_df)

    # Sort
    clean_df = clean_df.sort_values(by=['trip_id', 'timestamp'])

    final_output = clean_df.drop(columns=['true_start', 'true_end'])

    print(f"--- Audio Preprocessing Complete ---")
    print(f"Initial Rows: {initial_count}")
    print(f"Rows after strict Time Boundary sync: {post_time_filter} (Removed {initial_count - post_time_filter} invalid readings)")
    print(f"Rows after Validity checks: {post_validity_filter} (Removed {post_time_filter - post_validity_filter} corrupted readings)")

    final_output.to_csv(output_file, index=False)
    print(f"Cleaned synchronized audio data saved to {output_file}")


if __name__ == "__main__":
    preprocess_audio(
        'sensor_data/audio_intensity_data.csv',
        'trips/trips.csv',
        'processed_outputs/clean_audio.csv'
    )
