/**
 * devReset.ts — Wipe all demo trip data on server startup.
 *
 * Only runs in development. Deletes all rows tied to TRIP001/TRIP002/TRIP003
 * so every restart is a clean slate for re-testing.
 */
import pool from '../db/mysqlClient'

const DEMO_TRIP_IDS = ['TRIP221', 'TRIP222', 'TRIP223']
const placeholders = DEMO_TRIP_IDS.map(() => '?').join(', ')

export async function wipeDemoData(): Promise<void> {
    try {
        console.log('[dev-reset] Ensuring tables exist and seeding DRV001...');
        
        // 1. Ensure minimal tables exist so the demo doesn't crash
        await pool.query(`
            CREATE TABLE IF NOT EXISTS drivers (
                driver_id VARCHAR(10) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                city VARCHAR(50) NOT NULL,
                shift_preference ENUM('morning','evening','full_day') NOT NULL,
                avg_hours_per_day DECIMAL(4,1),
                avg_earnings_per_hr DECIMAL(8,2),
                experience_months SMALLINT,
                rating DECIMAL(3,1),
                created_at DATETIME NOT NULL DEFAULT NOW()
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS driver_goals (
                goal_id VARCHAR(10) PRIMARY KEY,
                driver_id VARCHAR(10) NOT NULL,
                date DATE NOT NULL,
                shift_start_time TIME NOT NULL,
                shift_end_time TIME NOT NULL,
                target_earnings DECIMAL(10,2) NOT NULL,
                target_hours DECIMAL(5,2) NOT NULL,
                current_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
                current_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
                status ENUM('achieved','in_progress','at_risk') NOT NULL DEFAULT 'in_progress',
                goal_completion_forecast ENUM('ahead','on_track','at_risk','warming_up','achieved') NOT NULL DEFAULT 'warming_up',
                updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                created_at DATETIME NOT NULL DEFAULT NOW(),
                FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
            );
        `);

        // 2. Insert or update the required driver
        await pool.query(`
            INSERT INTO drivers (
                driver_id, name, city, shift_preference,
                avg_hours_per_day, avg_earnings_per_hr, experience_months, rating
            )
            VALUES (
                'DRV001', 'Alex Kumar', 'Mumbai', 'morning',
                7.5, 185.00, 18, 4.8
            )
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                city = VALUES(city),
                shift_preference = VALUES(shift_preference),
                avg_hours_per_day = VALUES(avg_hours_per_day),
                avg_earnings_per_hr = VALUES(avg_earnings_per_hr),
                experience_months = VALUES(experience_months),
                rating = VALUES(rating)
        `);

        // 3. Insert or update the required goal
        await pool.query(`
            INSERT INTO driver_goals (
                goal_id, driver_id, date,
                shift_start_time, shift_end_time,
                target_earnings, target_hours,
                current_earnings, current_hours,
                status, goal_completion_forecast,
                updated_at
            )
            VALUES (
                'GOAL001', 'DRV001', '2024-02-06',
                '06:30:00', '14:30:00',
                1400.00, 8.0,
                1423.00, 7.5,
                'achieved', 'on_track',
                NOW()
            )
            ON DUPLICATE KEY UPDATE
                date = VALUES(date),
                shift_start_time = VALUES(shift_start_time),
                shift_end_time = VALUES(shift_end_time),
                target_earnings = VALUES(target_earnings),
                target_hours = VALUES(target_hours),
                current_earnings = VALUES(current_earnings),
                current_hours = VALUES(current_hours),
                status = VALUES(status),
                goal_completion_forecast = VALUES(goal_completion_forecast),
                updated_at = VALUES(updated_at)
        `);

        console.log('✅ [dev-reset] Tables ready, DRV001 seeded successfully.');
    } catch (err: any) {
        console.error('❌ [dev-reset] Failed to verify tables or seed DRV001:', err.message);
    }

    const tables = [
        'flag_events',
        'motion_events',
        'audio_events',
        'trip_summaries',
        'earnings_velocity_log',
        'trips',
    ]

    for (const table of tables) {
        const col = table === 'earnings_velocity_log' ? 'trip_id' : 'trip_id'
        try {
            const [result]: any = await pool.query(
                `DELETE FROM ${table} WHERE ${col} IN (${placeholders})`,
                DEMO_TRIP_IDS
            )
            if (result.affectedRows > 0) {
                console.log(`🗑️  [dev-reset] Cleared ${result.affectedRows} rows from ${table}`)
            }
        } catch (err: any) {
            // Non-fatal: table may not exist yet, or column name differs
            console.warn(`⚠️  [dev-reset] Skipped ${table}: ${err.message}`)
        }
    }

    console.log('✅ [dev-reset] Demo data wiped — fresh start!\n')
}
