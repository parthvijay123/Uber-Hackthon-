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
