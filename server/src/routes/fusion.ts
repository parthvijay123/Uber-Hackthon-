import { Router, Request, Response } from 'express'
import * as path from 'path'
import { CsvLoader } from '../loaders/csvLoader'
import { AccelLoader } from '../loaders/accelLoader'
import { AudioLoader } from '../loaders/audioLoader'
import { WindowBuilder } from '../engine/windowBuilder'
import { MotionProcessor } from '../engine/motionProcessor'
import { AudioProcessor } from '../engine/audioProcessor'
import { FusionEvaluator } from '../engine/fusionEvaluator'
import { TripProcessor } from '../workers/tripProcessor'
import { EventStore } from '../db/eventStore'

const router = Router()

// ── Module-level singletons (CSV loaded once at startup, not per-request) ────
const csvLoader = new CsvLoader()
const DATA_DIR = path.join(__dirname, '../data')
const accelLoader = new AccelLoader(
    csvLoader,
    [
        path.join(DATA_DIR, 'TRIP221_accelerometer_data.csv'),
        path.join(DATA_DIR, 'TRIP222_accelerometer_data.csv'),
        path.join(DATA_DIR, 'TRIP223_accelerometer_data.csv'),
    ]
)
const audioLoader = new AudioLoader(
    csvLoader,
    [
        path.join(DATA_DIR, 'TRIP221_audio_data.csv'),
        path.join(DATA_DIR, 'TRIP222_audio_data.csv'),
        path.join(DATA_DIR, 'TRIP223_audio_data.csv'),
    ]
)
const motionProcessor = new MotionProcessor()
const audioProcessor = new AudioProcessor()
const fusionEvaluator = new FusionEvaluator()
const eventStore = new EventStore()
const windowBuilder = new WindowBuilder()

const tripProcessor = new TripProcessor(
    accelLoader,
    audioLoader,
    motionProcessor,
    audioProcessor,
    fusionEvaluator,
    eventStore
)

// ── GET /api/fusion/:tripId ──────────────────────────────────────────────────
// Returns full TripAnalysisResult as JSON. Triggers processing.
router.get('/:tripId', async (req: Request, res: Response) => {
    const { tripId } = req.params
    try {
        const result = await tripProcessor.processTrip(tripId)
        console.log(
            `[${tripId}] processed in ${result.duration_ms}ms — ` +
            `${result.motion_events.length} motion, ` +
            `${result.audio_events.length} audio, ` +
            `${result.flag_events.length} flags`
        )
        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to process trip' })
    }
})

// ── GET /api/fusion/:tripId/stream ───────────────────────────────────────────
// SSE: processes trip upfront, then drip-feeds FlagEvents at 400ms intervals.
router.get('/:tripId/stream', async (req: Request, res: Response) => {
    const { tripId } = req.params

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    let result
    try {
        result = await tripProcessor.processTrip(tripId)
        console.log(
            `[${tripId}] processed in ${result.duration_ms}ms — ` +
            `${result.motion_events.length} motion, ` +
            `${result.audio_events.length} audio, ` +
            `${result.flag_events.length} flags`
        )
    } catch (err) {
        console.error(err)
        res.write('data: ERROR\n\n')
        res.end()
        return
    }

    const flags = result.flag_events

    if (flags.length === 0) {
        // No flags — send summary and close
        res.write(
            `data: SUMMARY:${JSON.stringify({
                motion_count: result.motion_events.length,
                audio_count: result.audio_events.length,
                flag_count: 0,
                duration_ms: result.duration_ms,
            })}\n\n`
        )
        res.write('data: DONE\n\n')
        res.end()
        return
    }

    let index = 0
    const interval = setInterval(() => {
        if (index >= flags.length) {
            // Send summary, then DONE
            res.write(
                `data: SUMMARY:${JSON.stringify({
                    motion_count: result.motion_events.length,
                    audio_count: result.audio_events.length,
                    flag_count: result.flag_events.length,
                    duration_ms: result.duration_ms,
                })}\n\n`
            )
            res.write('data: DONE\n\n')
            clearInterval(interval)
            res.end()
            return
        }
        res.write(`data: ${JSON.stringify(flags[index])}\n\n`)
        index++
    }, 400)

    req.on('close', () => clearInterval(interval))
})

// ── GET /api/flags/:tripId ───────────────────────────────────────────────────
// Reads directly from EventStore — no reprocessing.
export function createFlagsRouter() {
    const flagsRouter = Router()
    flagsRouter.get('/:tripId', (req: Request, res: Response) => {
        const { tripId } = req.params
        const flags = eventStore.getFlagsByTrip(tripId)
        res.json(flags)
    })
    return flagsRouter
}

export default router
