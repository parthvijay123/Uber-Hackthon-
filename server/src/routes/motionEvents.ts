import { Router, Request, Response } from 'express'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import { CsvLoader } from '../loaders/csvLoader'
import { AccelLoader } from '../loaders/accelLoader'
import { WindowBuilder } from '../engine/windowBuilder'
import { MotionProcessor } from '../engine/motionProcessor'
import { EventStore } from '../db/eventStore'
import { MotionEvent } from '../../../shared/types'

const router = Router()
const CSV_PATH = path.join(__dirname, '../data/accelerometer_data.csv')
const eventStore = new EventStore()

function processTrip(tripId: string): MotionEvent[] {
    const csvLoader = new CsvLoader()
    const accelLoader = new AccelLoader(csvLoader, CSV_PATH)
    const samples = accelLoader.getForTrip(tripId)

    const windowBuilder = new WindowBuilder()
    const windows = windowBuilder.buildWindows(samples, 15)

    const processor = new MotionProcessor()
    const events: MotionEvent[] = []

    for (const window of windows) {
        const result = processor.process(window)

        // Find matching sample by t_start elapsed_s for timestamp
        const matchingSample =
            window.samples.find((s) => s.elapsed_s === window.t_start) ?? window.samples[0]

        const event: MotionEvent = {
            event_id: uuid(),
            trip_id: result.trip_id,
            timestamp: matchingSample?.timestamp ?? '',
            elapsed_s: result.t_start,
            event_type: result.event_type,
            magnitude: result.peak_magnitude,
            delta_speed: result.delta_speed,
            score: result.score,
            explanation: result.explanation,
        }
        events.push(event)
    }

    return events
}

// GET /api/motion/:tripId
router.get('/:tripId', (req: Request, res: Response) => {
    const { tripId } = req.params
    try {
        const events = processTrip(tripId)
        eventStore.clear(tripId)
        eventStore.saveMany(events)
        res.json(events)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to process trip' })
    }
})

// GET /api/motion/:tripId/stream  (SSE)
router.get('/:tripId/stream', (req: Request, res: Response) => {
    const { tripId } = req.params

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    let events: MotionEvent[]
    try {
        events = processTrip(tripId)
        eventStore.clear(tripId)
        eventStore.saveMany(events)
    } catch (err) {
        console.error(err)
        res.write('data: ERROR\n\n')
        res.end()
        return
    }

    let index = 0

    const interval = setInterval(() => {
        if (index >= events.length) {
            res.write('data: DONE\n\n')
            clearInterval(interval)
            res.end()
            return
        }

        const event = events[index]
        res.write(`data: ${JSON.stringify(event)}\n\n`)
        index++
    }, 500)

    req.on('close', () => {
        clearInterval(interval)
    })
})

export default router
