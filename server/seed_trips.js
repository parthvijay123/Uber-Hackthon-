// require('dotenv').config();
// const fs = require('fs');
// const mysql = require('mysql2/promise');

// async function run() {
//   const csv = fs.readFileSync('src/data/trips.csv', 'utf8');
//   const lines = csv.trim().split('\n');
//   const headers = lines[0].split(',');
  
//   const conn = await mysql.createConnection({
//     host: process.env.DB_HOST || 'localhost',
//     user: process.env.DB_USER || 'root',
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME || 'driver_pulse'
//   });

//   for (let i = 1; i < lines.length; i++) {
//     const vals = lines[i].split(',');
//     if (vals.length < 12) continue;
    
//     // trip_id,driver_id,date,start_time,end_time,duration_min,distance_km,fare,surge_multiplier,pickup_location,dropoff_location,trip_status
//     await conn.query(
//       `INSERT IGNORE INTO trips (
//         trip_id, driver_id, date, start_time, end_time, duration_min, distance_km, fare, surge_multiplier, pickup_location, dropoff_location, trip_status
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [vals[0], vals[1], vals[2], vals[3], vals[4], Number(vals[5]), Number(vals[6]), Number(vals[7]), Number(vals[8]), vals[9], vals[10], vals[11]]
//     );
    
//     // Create dummy summaries for these historical trips to appear normally
//     await conn.query(
//       `INSERT IGNORE INTO trip_summaries (
//          trip_id, driver_id, date, duration_min, distance_km, fare, earnings_velocity, stress_score, trip_quality_rating, motion_events_count, audio_events_count, flagged_moments_count, max_severity
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [vals[0], vals[1], vals[2], Number(vals[5]), Number(vals[6]), Number(vals[7]), (Number(vals[7]) / (Number(vals[5]) / 60)).toFixed(2), 0.15, 'excellent', 0, 0, 0, 'low']
//     );
//   }
  
//   const [res] = await conn.query('SELECT count(*) as count from trips');
//   console.log('Seeded trips. Total trips:', res[0].count);
//   conn.end();
// }
// run().catch(console.error);
