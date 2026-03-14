/**
 * devReset.ts — Demo data lifecycle on server startup.
 *
 * 1. seedDemoProfile — Ensures drivers + driver_goals have DRV001/GOAL001
 *    so the dashboard can load (required before any user visits).
 * 2. wipeDemoData — Deletes rows tied to TRIP001/TRIP002/TRIP003
 *    so every restart is a clean slate for re-testing.
 */
import pool from '../db/mysqlClient'

const DEMO_TRIP_IDS = ['TRIP001', 'TRIP002', 'TRIP003']
const DEMO_DRIVER_ID = 'DRV001'
const DEMO_GOAL_ID = 'GOAL001'
const DEMO_DATE = '2024-02-06'

/** Ensures demo driver and goal exist so the dashboard can load. */
export async function seedDemoProfile(): Promise<void> {
    try {
        await pool.query(
            `INSERT IGNORE INTO drivers (driver_id, name, city, shift_preference)
             VALUES (?, 'Demo Driver', 'Bangalore', 'full_day')`,
            [DEMO_DRIVER_ID]
        )
        await pool.query(
            `INSERT IGNORE INTO driver_goals
             (goal_id, driver_id, date, shift_start_time, shift_end_time, target_earnings, target_hours)
             VALUES (?, ?, ?, '06:30:00', '14:30:00', 1400, 8.0)`,
            [DEMO_GOAL_ID, DEMO_DRIVER_ID, DEMO_DATE]
        )
        console.log('✅ [seed] Demo profile DRV001/GOAL001 ready')
    } catch (err: any) {
        console.error('❌ [seed] Failed to seed demo profile:', err.message)
        throw err
    }
}
const placeholders = DEMO_TRIP_IDS.map(() => '?').join(', ')

export async function wipeDemoData(): Promise<void> {
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
