/**
 * demoRouter.ts — Trip simulator demo API endpoints.
 *
 * GET  /api/demo/trips               → list the 3 available demo trips
 * POST /api/demo/:tripId/start       → insert trip row (status: ongoing)
 * POST /api/demo/:tripId/complete    → flush EventStore → MySQL
 *
 * The EventStore is populated by the existing /api/fusion/:tripId stream endpoint.
 * Once DONE fires, the client calls /complete to persist everything.
 */
import { Router, Request, Response } from 'express'
import * as path from 'path'
import * as fs from 'fs/promises'
import { v4 as uuid } from 'uuid'
import { CsvLoader } from '../loaders/csvLoader'
import { AccelLoader } from '../loaders/accelLoader'
import { AudioLoader } from '../loaders/audioLoader'
import { MotionProcessor } from '../engine/motionProcessor'
import { AudioProcessor } from '../engine/audioProcessor'
import { FusionEvaluator } from '../engine/fusionEvaluator'
import { EventStore } from '../db/eventStore'
import { TripProcessor } from '../workers/tripProcessor'
import {
    insertTripRecord,
    completeTripRecord,
    insertMotionEvents,
    insertAudioEvents,
    insertFlagEvents,
    insertTripSummary,
    appendVelocityLog,
    getCumulativeEarnings,
    getCompletedTripCount,
    getDriverGoal,
    VelocityLogRecord,
    TripSummaryRecord,
} from '../db/dbWriter'
import pool from '../db/mysqlClient'
import { FlagEvent, FlagSeverity, FlagType } from '../shared/types'

const router = Router()
const DATA_DIR = path.join(__dirname, '../data')
const DRIVER_ID = 'DRV001'
const GOAL_ID = 'GOAL001'

// ─── Demo trip metadata ───────────────────────────────────────────────────────

interface DemoTripMeta {
    trip_id: string
    label: string
    description: string
    start_time: string  // from first CSV row timestamp
    date: string        // YYYY-MM-DD
    duration_min: number
    fare: number
    distance_km: number
}

const DEMO_TRIPS: DemoTripMeta[] = [
    {
        trip_id: 'TRIP221',
        label: 'Morning Commute',
        description: 'Route with 3 audio conflict windows and a harsh braking event.',
        start_time: '07:00:00',   // 30 min into shift (shift starts 06:30)
        date: '2024-02-06',
        duration_min: 15,
        fare: 320.00,
        distance_km: 12.5,
    },
    {
        trip_id: 'TRIP222',
        label: 'Afternoon Run',
        description: 'Longer route with multiple motion events and moderate audio levels.',
        start_time: '09:30:00',   // 3 hrs into shift
        date: '2024-02-06',
        duration_min: 20,
        fare: 460.00,
        distance_km: 18.2,
    },
    {
        trip_id: 'TRIP223',
        label: 'Evening Peak',
        description: 'Rush-hour trip with elevated motion variability.',
        start_time: '12:00:00',   // 5.5 hrs into shift
        date: '2024-02-06',
        duration_min: 20,
        fare: 510.00,
        distance_km: 19.8,
    },
]

// ─── Per-trip AccelLoader/AudioLoader (one per trip, loaded on first use) ────

const TRIP_LOADERS = new Map<string, { accel: AccelLoader; audio: AudioLoader; processor: any }>()

// Map from demo trip ID to the actual CSV sensor file prefix
const TRIP_CSV_MAP: Record<string, string> = {
    'TRIP221': 'TRIP221',
    'TRIP222': 'TRIP222',
    'TRIP223': 'TRIP2223',
}

function getLoaders(tripId: string) {
    if (TRIP_LOADERS.has(tripId)) return TRIP_LOADERS.get(tripId)!

    const csvLoader = new CsvLoader()
    const csvPrefix = TRIP_CSV_MAP[tripId] ?? tripId
    const accelPath = tripId === 'TRIP223' ? path.join(DATA_DIR, 'TRIP2223_accelerometer_data.csv') : path.join(DATA_DIR, `${csvPrefix}_accelerometer_data.csv`);
    const audioPath = tripId === 'TRIP223' ? path.join(DATA_DIR, 'TRIP223_audio_data.csv') : path.join(DATA_DIR, `${csvPrefix}_audio_data.csv`);

    const accel = new AccelLoader(csvLoader, accelPath)
    const audio = new AudioLoader(csvLoader, audioPath)

    const entry = { accel, audio, processor: null }
    TRIP_LOADERS.set(tripId, entry)
    return entry
}


const demoEventStore = new EventStore()


function buildTripProcessor(tripId: string): TripProcessor {
    const { accel, audio } = getLoaders(tripId)
    return new TripProcessor(
        accel,
        audio,
        new MotionProcessor(),
        new AudioProcessor(),
        new FusionEvaluator(),
        demoEventStore
    )
}

router.get('/trips', async (_req: Request, res: Response) => {
    try {
        const [rows]: any = await pool.query(
            `SELECT trip_id, trip_status FROM trips WHERE trip_id IN (?)`,
            [DEMO_TRIPS.map(t => t.trip_id)]
        )
        const statuses = new Map<string, string>(rows.map((r: any) => [r.trip_id, r.trip_status]))

        const tripsWithStatus = DEMO_TRIPS.map(t => ({
            ...t,
            status: statuses.get(t.trip_id) || 'available'
        }))
        res.json(tripsWithStatus)
    } catch (err: any) {
        console.error('[Demo] list trips error:', err.message)
        res.json(DEMO_TRIPS.map(t => ({ ...t, status: 'available' })))
    }
})

router.post('/:tripId/start', async (req: Request, res: Response) => {
    const { tripId } = req.params
    const meta = DEMO_TRIPS.find(t => t.trip_id === tripId)
    if (!meta) {
        return res.status(404).json({ error: `Unknown demo trip: ${tripId}` })
    }

    try {

        demoEventStore.clear(tripId)
        demoEventStore.clearAudio(tripId)
        demoEventStore.clearFlags(tripId)


        await insertTripRecord({
            trip_id: meta.trip_id,
            driver_id: DRIVER_ID,
            date: meta.date,
            start_time: meta.start_time,
            fare: meta.fare,
            pickup_location: `Demo: ${meta.label} Start`,
            dropoff_location: `Demo: ${meta.label} End`,
        })

        console.log(`[Demo] Started trip ${tripId}`)
        res.json({ success: true, trip_id: tripId, meta })
    } catch (err: any) {
        console.error('[Demo] start error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

router.post('/:tripId/complete', async (req: Request, res: Response) => {
    const { tripId } = req.params
    const meta = DEMO_TRIPS.find(t => t.trip_id === tripId)
    if (!meta) {
        return res.status(404).json({ error: `Unknown demo trip: ${tripId}` })
    }

    try {
        // 1. Process the trip if EventStore is empty (re-process if needed)
        let motionEvents = demoEventStore.getByTrip(tripId)
        let audioEvents = demoEventStore.getAudioByTrip(tripId)
        let flagEvents = demoEventStore.getFlagsByTrip(tripId) as FlagEvent[]

        if (motionEvents.length === 0) {
            console.log(`[Demo] EventStore empty for ${tripId}, running processor now...`)
            const processor = buildTripProcessor(tripId)
            const result = await processor.processTrip(tripId)
            motionEvents = result.motion_events
            audioEvents = result.audio_events
            flagEvents = result.flag_events as FlagEvent[]
        }

        // 2. Bulk write events to MySQL
        await insertMotionEvents(motionEvents)
        await insertAudioEvents(audioEvents)
        await insertFlagEvents(flagEvents)

        // 3. Complete the trip row
        const endHH = addMinutesToTime(meta.start_time, meta.duration_min)
        await completeTripRecord(tripId, {
            end_time: endHH,
            duration_min: meta.duration_min,
            distance_km: meta.distance_km,
            fare: meta.fare,
        })

        // 4. Build and write trip summary
        const maxSev = computeMaxSeverity(flagEvents)
        const conflictFlags = flagEvents.filter(f => f.flag_type === FlagType.conflict_moment)
        const stressScore = computeStressScore(conflictFlags, meta.duration_min)
        const earningsVelocity = meta.fare / (meta.duration_min / 60)

        const summary: TripSummaryRecord = {
            trip_id: tripId,
            driver_id: DRIVER_ID,
            date: meta.date,
            duration_min: meta.duration_min,
            distance_km: meta.distance_km,
            fare: meta.fare,
            earnings_velocity: parseFloat(earningsVelocity.toFixed(2)),
            motion_events_count: motionEvents.length,
            audio_events_count: audioEvents.length,
            flagged_moments_count: conflictFlags.length,
            max_severity: maxSev,
            stress_score: parseFloat(stressScore.toFixed(3)),
            trip_quality_rating: computeTripRating(stressScore, conflictFlags.length, meta.duration_min),
        }
        await insertTripSummary(summary)

        // 5. Compute and write velocity log row
        const goal = await getDriverGoal(DRIVER_ID, meta.date)
        const cumulativeEarnings = await getCumulativeEarnings(DRIVER_ID, meta.date, tripId)
        const tripsCompleted = await getCompletedTripCount(DRIVER_ID, meta.date)

        // Elapsed hours: time from shift start to end of this trip.
        // Guard: never let elapsed be less than the trip's own duration
        // (prevents negative/zero division if trip times are before shift start).
        const shiftStartMs = parseTimeToMs(goal?.shift_start_time ?? meta.start_time)
        const tripEndMs = parseTimeToMs(addMinutesToTime(meta.start_time, meta.duration_min))
        const tripDurationHrs = meta.duration_min / 60
        const elapsedFromShift = (tripEndMs - shiftStartMs) / 3600000
        const elapsedHours = Math.max(tripDurationHrs, elapsedFromShift)

        const targetEarnings = parseFloat(goal?.target_earnings ?? '1400')
        const targetHours = parseFloat(goal?.target_hours ?? '8')
        const targetVelocity = targetEarnings / targetHours
        const currentVelocity = cumulativeEarnings / elapsedHours
        const velocityDelta = currentVelocity - targetVelocity

        const forecastStatus = computeForecastStatus(velocityDelta, targetVelocity)

        const velocityLog: VelocityLogRecord = {
            log_id: `VL-${tripId}-${Date.now()}`,
            driver_id: DRIVER_ID,
            goal_id: GOAL_ID,
            trip_id: tripId,
            timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
            cumulative_earnings: parseFloat(cumulativeEarnings.toFixed(2)),
            elapsed_hours: parseFloat(elapsedHours.toFixed(2)),
            current_velocity: parseFloat(currentVelocity.toFixed(2)),
            target_velocity: parseFloat(targetVelocity.toFixed(2)),
            velocity_delta: parseFloat(velocityDelta.toFixed(2)),
            trips_completed: tripsCompleted,
            forecast_status: forecastStatus,
        }
        await appendVelocityLog(velocityLog)

        // 6. Write a showcase JSON log under /Design (for presentations)
        await writeShowcaseLog({
            tripMeta: meta,
            motionEvents,
            audioEvents,
            flagEvents,
            summary,
            velocity: velocityLog,
        })

        console.log(
            `[Demo] Completed ${tripId}: fare=₹${meta.fare}, velocity=${currentVelocity.toFixed(
                1
            )}/hr, status=${forecastStatus}`
        )

        res.json({
            success: true,
            trip_id: tripId,
            summary,
            velocity: velocityLog,
        })
    } catch (err: any) {
        console.error('[Demo] complete error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// ─── GET /api/demo/stream/:tripId — process + stream (wraps fusion stream) ───
// This pre-processes using per-trip CSV files and populates demoEventStore.
router.get('/stream/:tripId', async (req: Request, res: Response) => {
    const { tripId } = req.params
    const meta = DEMO_TRIPS.find(t => t.trip_id === tripId)
    if (!meta) {
        return res.status(404).json({ error: `Unknown demo trip: ${tripId}` })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    try {
        const processor = buildTripProcessor(tripId)
        const result = await processor.processTrip(tripId)

        const flags = (result.flag_events as FlagEvent[]).slice().sort(
            (a, b) => a.elapsed_s - b.elapsed_s
        )

        if (flags.length === 0) {
            res.write(`data: SUMMARY:${JSON.stringify({
                motion_count: result.motion_events.length,
                audio_count: result.audio_events.length,
                flag_count: 0,
                duration_ms: result.duration_ms,
            })}\n\n`)
            res.write('data: DONE\n\n')
            res.end()
            return
        }

        // Stream flags spaced out in (accelerated) trip-time order so they
        // appear to happen "in real time" along the trip timeline.
        const SPEED_FACTOR_MS_PER_TRIP_SEC = 50 // 1s of trip time = 50ms real
        const MIN_GAP_MS = 250

        let cancelled = false
        req.on('close', () => {
            cancelled = true
        })

        const streamFlag = (idx: number, prevElapsed: number) => {
            if (cancelled) return

            if (idx >= flags.length) {
                res.write(`data: SUMMARY:${JSON.stringify({
                    motion_count: result.motion_events.length,
                    audio_count: result.audio_events.length,
                    flag_count: flags.length,
                    duration_ms: result.duration_ms,
                })}\n\n`)
                res.write('data: DONE\n\n')
                res.end()
                return
            }

            const flag = flags[idx]
            const deltaTripSeconds = Math.max(0, flag.elapsed_s - prevElapsed)
            const delayMs = Math.max(MIN_GAP_MS, deltaTripSeconds * SPEED_FACTOR_MS_PER_TRIP_SEC)

            setTimeout(() => {
                if (cancelled) return
                res.write(`data: ${JSON.stringify(flag)}\n\n`)
                streamFlag(idx + 1, flag.elapsed_s)
            }, delayMs)
        }

        // Kick off the first flag immediately (with a small minimum delay).
        streamFlag(0, 0)
    } catch (err: any) {
        console.error('[Demo] stream error:', err.message)
        res.write('data: ERROR\n\n')
        res.end()
    }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMinutesToTime(timeStr: string, minutes: number): string {
    const [h, m, s] = timeStr.split(':').map(Number)
    const totalMin = h * 60 + m + minutes
    const newH = Math.floor(totalMin / 60) % 24
    const newM = totalMin % 60
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function parseTimeToMs(timeStr: string): number {
    const [h, m, s] = timeStr.split(':').map(Number)
    return (h * 3600 + m * 60 + (s || 0)) * 1000
}

function computeMaxSeverity(flags: FlagEvent[]): 'none' | 'low' | 'medium' | 'high' {
    if (flags.some(f => f.severity === FlagSeverity.high)) return 'high'
    if (flags.some(f => f.severity === FlagSeverity.medium)) return 'medium'
    if (flags.some(f => f.severity === FlagSeverity.low)) return 'low'
    return 'none'
}

function computeStressScore(conflictFlags: FlagEvent[], tripDurationMin: number): number {
    // No fused conflict moments = no stress.
    if (conflictFlags.length === 0 || tripDurationMin <= 0) {
        return 0
    }

    const avgConflictScore =
        conflictFlags.reduce((sum, f) => sum + f.combined_score, 0) / conflictFlags.length

    // Frequency factor: more conflict flags in a shorter trip => higher stress.
    // Example: 1 flag in 20 min → low factor; 4+ flags in 20 min → factor ~1.
    const densityPerMin = conflictFlags.length / Math.max(tripDurationMin, 1)
    const densityFactor = Math.min(1, densityPerMin * 5) // 1 flag every 5min ≈ factor 1

    const rawStress = avgConflictScore * densityFactor

    // Bound to [0, 1] in case combined scores change in future.
    return Math.min(1.0, rawStress)
}

function computeTripRating(stressScore: number, flagCount: number, durationMin: number): 'excellent' | 'good' | 'fair' | 'poor' {
    const flagsPerMin = flagCount / Math.max(1, durationMin)
    if (stressScore < 0.22 && flagsPerMin < 0.12) return 'excellent'
    if (stressScore < 0.45 && flagsPerMin < 0.30) return 'good'
    if (stressScore < 0.68) return 'fair'
    return 'poor'
}

function computeForecastStatus(delta: number, targetVelocity: number): 'ahead' | 'on_track' | 'at_risk' | 'behind' {
    const pct = delta / targetVelocity
    if (pct >= 0.1) return 'ahead'
    if (pct >= -0.05) return 'on_track'
    if (pct >= -0.2) return 'at_risk'
    return 'behind'
}

// ─── Showcase JSON log writer ───────────────────────────────────────────────────

async function writeShowcaseLog(payload: {
    tripMeta: DemoTripMeta
    motionEvents: any[]
    audioEvents: any[]
    flagEvents: FlagEvent[]
    summary: TripSummaryRecord
    velocity: VelocityLogRecord
}): Promise<void> {
    try {
        // Design folder lives at repo root: ../../Design from routes directory.
        const designDir = path.join(__dirname, '../../Design')
        await fs.mkdir(designDir, { recursive: true })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const fileName = `showcase_${payload.tripMeta.trip_id}_${timestamp}.json`
        const filePath = path.join(designDir, fileName)

        const motionById = new Map<string, any>(
            payload.motionEvents.map((m: any) => [m.event_id, m])
        )
        const audioById = new Map<string, any>(
            payload.audioEvents.map((a: any) => [a.event_id, a])
        )

        const enrichedFlags = payload.flagEvents.map((f) => {
            const motion = f.motion_event_id ? motionById.get(f.motion_event_id) : null
            const audio = f.audio_event_id ? audioById.get(f.audio_event_id) : null

            let category: string = 'flag'
            if (motion && audio) {
                const sustained =
                    typeof audio.is_sustained === 'boolean' && audio.is_sustained
                        ? '_sustained_stress'
                        : ''
                category = `motion_plus_audio${sustained}`
            } else if (motion) {
                category = 'motion_only'
            } else if (audio) {
                const sustained =
                    typeof audio.is_sustained === 'boolean' && audio.is_sustained
                        ? '_sustained_stress'
                        : ''
                category = `audio_only${sustained}`
            }

            return {
                ...f,
                event_category: category,
                motion_event_type: motion?.event_type ?? null,
                audio_class: audio?.audio_class ?? null,
                audio_severity: audio?.severity ?? null,
                audio_is_sustained: audio?.is_sustained ?? null,
            }
        })

        const body = {
            generated_at: new Date().toISOString(),
            trip_meta: payload.tripMeta,
            summary: payload.summary,
            velocity_snapshot: payload.velocity,
            counts: {
                motion_events: payload.motionEvents.length,
                audio_events: payload.audioEvents.length,
                flag_events: payload.flagEvents.length,
            },
            // For showcase purposes we include full events so they can be
            // visualized later if needed.
            motion_events: payload.motionEvents,
            audio_events: payload.audioEvents,
            flag_events: enrichedFlags,
        }

        await fs.writeFile(filePath, JSON.stringify(body, null, 2), 'utf8')
        console.log('[Demo] Wrote showcase log to', filePath)
    } catch (err: any) {
        console.error('[Demo] Failed to write showcase log:', err.message)
    }
}

export { demoEventStore }
export default router
