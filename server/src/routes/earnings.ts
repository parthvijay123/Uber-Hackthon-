/**
 * earnings.ts — Live dashboard data from MySQL.
 *
 * This replaces the old CSV-based EarningsLoader with direct DB queries
 * so the dashboard reflects real-time changes after each demo trip completes.
 */
import { Router, Request, Response } from 'express'
import pool from '../db/mysqlClient'

const router = Router()

// ─── GET /api/driver/:driverId/dashboard ─────────────────────────────────────

router.get('/:driverId/dashboard', async (req: Request, res: Response) => {
    const { driverId } = req.params

    try {
        // 1. Fetch the driver_goals row (immutable shift config)
        const [goalRows]: any = await pool.query(
            `SELECT * FROM driver_goals WHERE driver_id = ? ORDER BY date DESC LIMIT 1`,
            [driverId]
        )
        if (!goalRows || goalRows.length === 0) {
            return res.status(404).json({ error: 'Driver profile not found.' })
        }
        const goalRow = goalRows[0]

        // 2. Fetch the latest velocity log (the live pacing state)
        const [velRows]: any = await pool.query(
            `SELECT * FROM earnings_velocity_log
             WHERE driver_id = ?
             ORDER BY timestamp DESC
             LIMIT 20`,
            [driverId]
        )
        const velocityLogs = velRows.reverse() // chronological order

        // 3. Fetch today's completed trips
        const [tripRows]: any = await pool.query(
            `SELECT t.trip_id, t.driver_id, t.date, t.start_time, t.end_time,
                    t.duration_min, t.distance_km, t.fare, t.surge_multiplier,
                    t.pickup_location, t.dropoff_location, t.trip_status,
                    ts.stress_score, ts.trip_quality_rating as trip_rating
             FROM trips t
             LEFT JOIN trip_summaries ts ON t.trip_id = ts.trip_id
             WHERE t.driver_id = ? AND t.date = ?
             ORDER BY t.start_time ASC`,
            [driverId, goalRow.date]
        )

        // 4. Count total flags today
        const [flagCount]: any = await pool.query(
            `SELECT COUNT(*) as cnt FROM flag_events
             WHERE driver_id = ? AND DATE(timestamp) = ?`,
            [driverId, goalRow.date]
        )

        // 5. Compute current_earnings from today's completed trips (not from driver_goals)
        const [earningsRow]: any = await pool.query(
            `SELECT COALESCE(SUM(fare), 0) as total
             FROM trips
             WHERE driver_id = ? AND date = ? AND trip_status = 'completed'`,
            [driverId, goalRow.date]
        )
        const currentEarnings = parseFloat(earningsRow[0]?.total ?? '0')

        // Latest velocity log for live velocity
        const latestVel = velocityLogs.length > 0 ? velocityLogs[velocityLogs.length - 1] : null

        // Build the goal object in the shape the frontend expects
        const goal = {
            goal_id: goalRow.goal_id,
            driver_id: goalRow.driver_id,
            date: goalRow.date,
            shift_start_time: goalRow.shift_start_time,
            shift_end_time: goalRow.shift_end_time,
            target_earnings: parseFloat(goalRow.target_earnings),
            target_hours: parseFloat(goalRow.target_hours),
            // Live: sum from completed trips, not the stale seed value
            current_earnings: currentEarnings,
            current_hours: latestVel ? parseFloat(latestVel.elapsed_hours) : 0,
            status: currentEarnings >= parseFloat(goalRow.target_earnings) ? 'achieved' : 'in_progress',
            earnings_velocity: latestVel ? parseFloat(latestVel.current_velocity) : 0,
            goal_completion_forecast: latestVel
                ? latestVel.forecast_status
                : (currentEarnings === 0 ? 'warming_up' : 'on_track'),
        }

        const recentTrips = tripRows.map((t: any) => ({
            trip_id: t.trip_id,
            driver_id: t.driver_id,
            date: t.date,
            start_time: t.start_time,
            end_time: t.end_time,
            duration_min: t.duration_min,
            distance_km: parseFloat(t.distance_km ?? '0'),
            fare: parseFloat(t.fare ?? '0'),
            surge_multiplier: parseFloat(t.surge_multiplier ?? '1'),
            pickup_location: t.pickup_location ?? '',
            dropoff_location: t.dropoff_location ?? '',
            trip_status: t.trip_status,
            stress_score: t.stress_score ? parseFloat(t.stress_score) : null,
            trip_rating: t.trip_rating ?? null,
        }))

        const velLogsFormatted = velocityLogs.map((v: any) => ({
            log_id: v.log_id,
            driver_id: v.driver_id,
            date: goalRow.date,
            timestamp: v.timestamp,
            cumulative_earnings: parseFloat(v.cumulative_earnings),
            elapsed_hours: parseFloat(v.elapsed_hours),
            current_velocity: parseFloat(v.current_velocity),
            target_velocity: parseFloat(v.target_velocity),
            velocity_delta: parseFloat(v.velocity_delta),
            trips_completed: v.trips_completed,
            forecast_status: v.forecast_status,
        }))

        res.json({
            driverId,
            goal,
            velocityLogs: velLogsFormatted,
            recentTrips,
            totalFlagsToday: parseInt(flagCount[0]?.cnt ?? '0'),
        })
    } catch (err: any) {
        console.error('[earnings] dashboard error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

export default router
