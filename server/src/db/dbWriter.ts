/**
 * dbWriter.ts — MySQL persistence helpers for the trip simulator.
 *
 * All functions are idempotent with INSERT IGNORE / INSERT ... ON DUPLICATE KEY
 * so re-running a trip through the demo does not duplicate rows.
 */
import pool from './mysqlClient'
import { MotionEvent, AudioEvent, FlagEvent } from '../../../shared/types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TripRecord {
    trip_id: string
    driver_id: string
    date: string          // 'YYYY-MM-DD'
    start_time: string    // 'HH:MM:SS'
    fare: number
    pickup_location?: string
    dropoff_location?: string
}

export interface TripCompletionData {
    end_time: string       // 'HH:MM:SS'
    duration_min: number
    distance_km: number
    fare: number
}

export interface TripSummaryRecord {
    trip_id: string
    driver_id: string
    date: string
    duration_min: number
    distance_km: number
    fare: number
    earnings_velocity: number
    motion_events_count: number
    audio_events_count: number
    flagged_moments_count: number
    max_severity: 'none' | 'low' | 'medium' | 'high'
    stress_score: number
    trip_quality_rating: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface VelocityLogRecord {
    log_id: string
    driver_id: string
    goal_id: string
    trip_id: string
    timestamp: string      // ISO datetime
    cumulative_earnings: number
    elapsed_hours: number
    current_velocity: number
    target_velocity: number
    velocity_delta: number
    trips_completed: number
    forecast_status: 'ahead' | 'on_track' | 'at_risk' | 'behind'
}

// ─── Trip table helpers ───────────────────────────────────────────────────────

export async function insertTripRecord(trip: TripRecord): Promise<void> {
    await pool.query(
        `INSERT IGNORE INTO trips
           (trip_id, driver_id, date, start_time, fare, surge_multiplier, trip_status, pickup_location, dropoff_location, created_at)
         VALUES (?, ?, ?, ?, ?, 1.0, 'ongoing', ?, ?, NOW())`,
        [
            trip.trip_id,
            trip.driver_id,
            trip.date,
            trip.start_time,
            trip.fare,
            trip.pickup_location ?? 'Demo Start',
            trip.dropoff_location ?? 'Demo End',
        ]
    )
}

export async function completeTripRecord(
    tripId: string,
    data: TripCompletionData
): Promise<void> {
    await pool.query(
        `UPDATE trips
         SET trip_status = 'completed',
             end_time     = ?,
             duration_min = ?,
             distance_km  = ?,
             fare         = ?
         WHERE trip_id = ?`,
        [data.end_time, data.duration_min, data.distance_km, data.fare, tripId]
    )
}

// ─── Motion events ────────────────────────────────────────────────────────────

export async function insertMotionEvents(events: MotionEvent[]): Promise<void> {
    if (events.length === 0) return
    const rows = events.map((e) => [
        e.event_id,
        e.trip_id,
        e.trip_id.startsWith('TRIP') ? 'DRV001' : 'DRV001',
        e.timestamp || new Date().toISOString().slice(0, 19).replace('T', ' '),
        e.elapsed_s,
        e.event_type,
        e.magnitude,
        e.delta_speed,
        e.score,
        e.explanation,
    ])

    await pool.query(
        `INSERT IGNORE INTO motion_events
           (event_id, trip_id, driver_id, timestamp, elapsed_s, event_type, magnitude, delta_speed, score, explanation)
         VALUES ?`,
        [rows]
    )
}

// ─── Audio events ─────────────────────────────────────────────────────────────

export async function insertAudioEvents(events: AudioEvent[]): Promise<void> {
    if (events.length === 0) return
    const rows = events.map((e) => [
        e.event_id,
        e.trip_id,
        'DRV001',
        e.timestamp || new Date().toISOString().slice(0, 19).replace('T', ' '),
        e.elapsed_s,
        e.peak_db,
        e.avg_db,
        e.duration_s,
        e.audio_class,
        e.severity,
        e.is_sustained ? 1 : 0,
        0, // score — not on AudioEvent type; stored as 0 for now
    ])

    await pool.query(
        `INSERT IGNORE INTO audio_events
           (event_id, trip_id, driver_id, timestamp, elapsed_s, peak_db, avg_db, duration_s, audio_class, severity, is_sustained, score)
         VALUES ?`,
        [rows]
    )
}

// ─── Flag events ──────────────────────────────────────────────────────────────

export async function insertFlagEvents(events: FlagEvent[]): Promise<void> {
    if (events.length === 0) return
    const rows = events.map((e) => [
        e.flag_id,
        e.trip_id,
        e.driver_id || 'DRV001',
        e.motion_event_id ?? null,
        e.audio_event_id ?? null,
        e.timestamp || new Date().toISOString().slice(0, 19).replace('T', ' '),
        e.elapsed_s,
        e.flag_type,
        e.severity,
        e.motion_score,
        e.audio_score,
        e.combined_score,
        e.explanation,
        e.context,
        'PENDING',
        0,
        null,
    ])

    await pool.query(
        `INSERT IGNORE INTO flag_events
           (flag_id, trip_id, driver_id, motion_event_id, audio_event_id,
            timestamp, elapsed_s, flag_type, severity,
            motion_score, audio_score, combined_score,
            explanation, context, upload_status, retry_count, next_retry_at, created_at)
         VALUES ?`,
        [rows.map(r => [...r, new Date()])]
    )
}

// ─── Trip summary ─────────────────────────────────────────────────────────────

export async function insertTripSummary(s: TripSummaryRecord): Promise<void> {
    await pool.query(
        `INSERT INTO trip_summaries
           (trip_id, driver_id, date, duration_min, distance_km, fare,
            earnings_velocity, motion_events_count, audio_events_count,
            flagged_moments_count, max_severity, stress_score, trip_quality_rating)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           trip_quality_rating = VALUES(trip_quality_rating),
           stress_score = VALUES(stress_score)`,
        [
            s.trip_id, s.driver_id, s.date, s.duration_min, s.distance_km, s.fare,
            s.earnings_velocity, s.motion_events_count, s.audio_events_count,
            s.flagged_moments_count, s.max_severity, s.stress_score, s.trip_quality_rating,
        ]
    )
}

// ─── Velocity log ─────────────────────────────────────────────────────────────

export async function appendVelocityLog(log: VelocityLogRecord): Promise<void> {
    await pool.query(
        `INSERT IGNORE INTO earnings_velocity_log
           (log_id, driver_id, goal_id, trip_id, timestamp,
            cumulative_earnings, elapsed_hours,
            current_velocity, target_velocity, velocity_delta,
            trips_completed, forecast_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            log.log_id, log.driver_id, log.goal_id, log.trip_id, log.timestamp,
            log.cumulative_earnings, log.elapsed_hours,
            log.current_velocity, log.target_velocity, log.velocity_delta,
            log.trips_completed, log.forecast_status,
        ]
    )
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/** Sum fares of all completed trips for a driver on a given date, excluding the current one being inserted. */
export async function getCumulativeEarnings(
    driverId: string,
    date: string,
    upToAndIncludingTripId: string
): Promise<number> {
    const [rows]: any = await pool.query(
        `SELECT COALESCE(SUM(fare), 0) AS total
         FROM trips
         WHERE driver_id = ? AND date = ? AND trip_status = 'completed'`,
        [driverId, date]
    )
    return parseFloat(rows[0]?.total ?? '0')
}

/** Count completed trips for a driver on a given date. */
export async function getCompletedTripCount(driverId: string, date: string): Promise<number> {
    const [rows]: any = await pool.query(
        `SELECT COUNT(*) AS cnt FROM trips
         WHERE driver_id = ? AND date = ? AND trip_status = 'completed'`,
        [driverId, date]
    )
    return parseInt(rows[0]?.cnt ?? '0')
}

/** Fetch the driver_goals row for a driver on a given date. */
export async function getDriverGoal(driverId: string, date: string): Promise<any> {
    const [rows]: any = await pool.query(
        `SELECT * FROM driver_goals WHERE driver_id = ? AND date = ? LIMIT 1`,
        [driverId, date]
    )
    return rows[0] ?? null
}
