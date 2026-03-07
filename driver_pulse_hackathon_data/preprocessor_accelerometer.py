import pandas as pd
import numpy as np
import math

def preprocess_accelerometer(sensor_file, trips_file, output_file):
    print("Loading raw files...")
    accel_df = pd.read_csv(sensor_file, parse_dates=['timestamp'])
    trips_df = pd.read_csv(trips_file)

    # Convert trips date/time columns to true timestamps
    trips_df['true_start'] = pd.to_datetime(trips_df['date'] + ' ' + trips_df['start_time'])
    trips_df['true_end'] = trips_df['true_start'] + pd.to_timedelta(trips_df['duration_min'], unit='m')

    # Merge sensor data with reliable trip boundaries
    merged_df = accel_df.merge(
        trips_df[['trip_id', 'driver_id', 'true_start', 'true_end']], 
        on='trip_id', 
        how='left'
    )

    initial_count = len(merged_df)

    # 1. Filter out data that falls outside the true trip boundaries
    clean_df = merged_df[
        (merged_df['timestamp'] >= merged_df['true_start']) & 
        (merged_df['timestamp'] <= merged_df['true_end'])
    ].copy()

    post_time_filter = len(clean_df)
    
    # 2. Filter out missing or obviously corrupted sensor readings
    # Dropping rows where critical XYZ values are missing
    clean_df.dropna(subset=['accel_x', 'accel_y', 'accel_z'], inplace=True)
    
    # Dropping physically impossible readings (e.g., > 100 Gs on a phone)
    # 1G = 9.8 m/s^2. 100G = 980 m/s^2
    valid_range_filter = (
        (clean_df['accel_x'].abs() < 980) & 
        (clean_df['accel_y'].abs() < 980) & 
        (clean_df['accel_z'].abs() < 980)
    )
    clean_df = clean_df[valid_range_filter]

    post_validity_filter = len(clean_df)
    
    # 3. Apply Low-Pass Filter Simulation (Smoothing)
    # In a real edge device, a continuous low-pass filter is applied to stream.
    # Here, we simulate by applying a rolling window average to smooth out minor vibrations.
    clean_df = clean_df.sort_values(by=['trip_id', 'timestamp'])
    
    # We apply smoothing only if there are enough points in a trip
    def smooth_group(group):
        if len(group) >= 3:
            # Smooth xyz, keep other columns intact
            smoothed_xyz = group[['accel_x', 'accel_y', 'accel_z']].rolling(window=3, min_periods=1, center=True).mean()
            group[['accel_x', 'accel_y', 'accel_z']] = smoothed_xyz
        return group
        
    clean_df = clean_df.groupby('trip_id', group_keys=False).apply(smooth_group)

    # 4. Feature Engineering: Calculate horizontal magnitude
    clean_df['horizontal_magnitude'] = np.sqrt(clean_df['accel_x']**2 + clean_df['accel_y']**2)
    
    # 5. Feature Engineering: Calculate Delta Speed
    # To differentiate harsh braking from harsh acceleration
    clean_df['delta_speed'] = clean_df.groupby('trip_id')['speed_kmh'].diff().fillna(0)

    # Drop intermediate columns used for time boundaries
    final_output = clean_df.drop(columns=['true_start', 'true_end'])

    print(f"--- Preprocessing Complete ---")
    print(f"Initial Rows: {initial_count}")
    print(f"Rows after strict Time Boundary sync: {post_time_filter} (Removed {initial_count - post_time_filter} invalid/out-of-trip readings)")
    print(f"Rows after Validity checks: {post_validity_filter} (Removed {post_time_filter - post_validity_filter} corrupted readings)")
    
    final_output.to_csv(output_file, index=False)
    print(f"Cleaned synchronized data saved to {output_file}")


if __name__ == "__main__":
    preprocess_accelerometer(
        'sensor_data/accelerometer_data.csv',
        'trips/trips.csv',
        'processed_outputs/clean_accelerometer.csv'
    )
