import pool from './mysqlClient';
import { CsvLoader } from '../loaders/csvLoader';
import * as path from 'path';

async function seedDriverGoals() {
    const csvLoader = new CsvLoader();
    const dataPath = path.join(__dirname, '../data/driver_goals.csv');
    
    console.log(`Seeding driver goals from ${dataPath}...`);
    
    try {
        const rows = csvLoader.parseWithHeaders<any>(dataPath, row => row);
        
        let driversSeeded = new Set();
        
        for (const row of rows) {
            // First ensure the driver exists to satisfy foreign key constraints
            if (!driversSeeded.has(row.driver_id)) {
                await pool.query(
                    `INSERT IGNORE INTO drivers (driver_id, name, city, shift_preference, avg_hours_per_day, avg_earnings_per_hr, experience_months, rating)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [row.driver_id, `Driver ${row.driver_id.replace('DRV', '')}`, 'Mumbai', 'full_day', 8.0, 200, 12, 4.9]
                );
                driversSeeded.add(row.driver_id);
            }
        
            await pool.query(
                `INSERT IGNORE INTO driver_goals
                   (goal_id, driver_id, date, shift_start_time, shift_end_time,
                    target_earnings, target_hours)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.goal_id, row.driver_id, row.date, row.shift_start_time, row.shift_end_time,
                    parseFloat(row.target_earnings), parseFloat(row.target_hours)
                ]
            );
        }
        
        console.log(`✅ Seeded ${rows.length} driver goals and ${driversSeeded.size} drivers.`);
        process.exit(0);
    } catch (err: any) {
        console.error('❌ Error seeding driver goals:', err.message);
        process.exit(1);
    }
}

seedDriverGoals();
