import pool from './mysqlClient';

async function seedDriverGoals() {
    console.log('Seeding minimal required driver and goal data (only these rows)...');

    try {
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        await pool.query('TRUNCATE TABLE driver_goals');
        await pool.query('TRUNCATE TABLE drivers');
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');

        await pool.query(
            `INSERT INTO drivers (
                driver_id, name, city, shift_preference,
                avg_hours_per_day, avg_earnings_per_hr, experience_months, rating
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['DRV001', 'Alex Kumar', 'Mumbai', 'morning', 7.5, 185.00, 18, 4.8]
        );

        await pool.query(
            `INSERT INTO driver_goals (
                goal_id, driver_id, date,
                shift_start_time, shift_end_time,
                target_earnings, target_hours,
                current_earnings, current_hours,
                status, goal_completion_forecast,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            ['GOAL001', 'DRV001', '2024-02-06', '06:30:00', '14:30:00', 1400.00, 8.0, 1423.00, 7.5, 'achieved', 'on_track']
        );

        console.log('✅ Seed data inserted successfully.');
        process.exit(0);
    } catch (err: any) {
        console.error('❌ Error seeding driver goals:', err.message);
        process.exit(1);
    }
}

seedDriverGoals();
