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
import { FlagEvent, FlagSeverity } from '../../../shared/types'

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
        trip_id: 'TRIP001',
        label: 'Morning Commute',
        description: 'Route with 3 audio conflict windows and a harsh braking event.',
        start_time: '07:00:00',   // 30 min into shift (shift starts 06:30)
        date: '2024-02-06',
        duration_min: 15,
        fare: 320.00,
        distance_km: 12.5,
    },
    {
        trip_id: 'TRIP002',
        label: 'Afternoon Run',
        description: 'Longer route with multiple motion events and moderate audio levels.',
        start_time: '09:30:00',   // 3 hrs into shift
        date: '2024-02-06',
        duration_min: 20,
        fare: 460.00,
        distance_km: 18.2,
    },
    {
        trip_id: 'TRIP003',
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

function getLoaders(tripId: string) {
    if (TRIP_LOADERS.has(tripId)) return TRIP_LOADERS.get(tripId)!

    const csvLoader = new CsvLoader()
    const accelPath = path.join(DATA_DIR, `${tripId}_accelerometer_data.csv`)
    const audioPath = path.join(DATA_DIR, `${tripId}_audio_data.csv`)

    const accel = new AccelLoader(csvLoader, accelPath)
    const audio = new AudioLoader(csvLoader, audioPath)

    const entry = { accel, audio, processor: null }
    TRIP_LOADERS.set(tripId, entry)
    return entry
}

// One shared EventStore for the demo
const demoEventStore = new EventStore()

// One TripProcessor that is re-created per trip to swap loaders
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

// ─── GET /api/demo/trips ──────────────────────────────────────────────────────

router.get('/trips', (_req: Request, res: Response) => {
    res.json(DEMO_TRIPS)
})

// ─── POST /api/demo/:tripId/start ─────────────────────────────────────────────

router.post('/:tripId/start', async (req: Request, res: Response) => {
    const { tripId } = req.params
    const meta = DEMO_TRIPS.find(t => t.trip_id === tripId)
    if (!meta) {
        return res.status(404).json({ error: `Unknown demo trip: ${tripId}` })
    }

    try {
        // Clear any stale in-memory state from a previous run
        demoEventStore.clear(tripId)
        demoEventStore.clearAudio(tripId)
        demoEventStore.clearFlags(tripId)

        // Insert trip row (IGNORE if already exists from a previous demo run)
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

// ─── POST /api/demo/:tripId/complete ─────────────────────────────────────────

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
        const stressScore = computeStressScore(flagEvents, motionEvents)
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
            flagged_moments_count: flagEvents.length,
            max_severity: maxSev,
            stress_score: parseFloat(stressScore.toFixed(3)),
            trip_quality_rating: computeTripRating(stressScore, flagEvents.length),
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

        console.log(`[Demo] Completed ${tripId}: fare=₹${meta.fare}, velocity=${currentVelocity.toFixed(1)}/hr, status=${forecastStatus}`)

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

        const flags = result.flag_events as FlagEvent[]

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

        let index = 0
        const interval = setInterval(() => {
            if (index >= flags.length) {
                res.write(`data: SUMMARY:${JSON.stringify({
                    motion_count: result.motion_events.length,
                    audio_count: result.audio_events.length,
                    flag_count: flags.length,
                    duration_ms: result.duration_ms,
                })}\n\n`)
                res.write('data: DONE\n\n')
                clearInterval(interval)
                res.end()
                return
            }
            res.write(`data: ${JSON.stringify(flags[index])}\n\n`)
            index++
        }, 400)

        req.on('close', () => clearInterval(interval))
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

function computeStressScore(flags: FlagEvent[], motionEvents: any[]): number {
    if (flags.length === 0 && motionEvents.length === 0) return 0
    const avgFlagScore = flags.length > 0
        ? flags.reduce((sum, f) => sum + f.combined_score, 0) / flags.length
        : 0
    const harshCount = motionEvents.filter((e: any) => e.event_type === 'harsh' || e.event_type === 'collision').length
    const harshPenalty = Math.min(0.3, harshCount * 0.05)
    return Math.min(1.0, avgFlagScore + harshPenalty)
}

function computeTripRating(stressScore: number, flagCount: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (stressScore < 0.2 && flagCount <= 1) return 'excellent'
    if (stressScore < 0.45 && flagCount <= 3) return 'good'
    if (stressScore < 0.7) return 'fair'
    return 'poor'
}

function computeForecastStatus(delta: number, targetVelocity: number): 'ahead' | 'on_track' | 'at_risk' | 'behind' {
    const pct = delta / targetVelocity
    if (pct >= 0.1) return 'ahead'
    if (pct >= -0.05) return 'on_track'
    if (pct >= -0.2) return 'at_risk'
    return 'behind'
}

export { demoEventStore }
export default router
