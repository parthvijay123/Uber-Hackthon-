import { Router, Request, Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { CsvLoader } from '../loaders/csvLoader'
import { AudioLoader } from '../loaders/audioLoader'
import { AudioProcessor } from '../engine/audioProcessor'
import { EventStore } from '../db/eventStore'
import { AudioBatchWindow, AudioEvent, AudioSample } from '../shared/types'

const router = Router()
const eventStore = new EventStore()

// ── Local helper: build 30-second AudioBatchWindows ──────────────────────────
function buildAudioWindows(samples: AudioSample[], windowSizeSeconds: number): AudioBatchWindow[] {
    const sorted = [...samples].sort((a, b) => a.elapsed_s - b.elapsed_s)
    const buckets = new Map<number, AudioSample[]>()

    for (const sample of sorted) {
        const idx = Math.floor(sample.elapsed_s / windowSizeSeconds)
        if (!buckets.has(idx)) buckets.set(idx, [])
        buckets.get(idx)!.push(sample)
    }

    const windows: AudioBatchWindow[] = []
    for (const [, bucket] of [...buckets.entries()].sort(([a], [b]) => a - b)) {
        if (bucket.length === 0) continue
        const t_start = Math.min(...bucket.map((s) => s.elapsed_s))
        const t_end = Math.max(...bucket.map((s) => s.elapsed_s))
        const trip_id = bucket[0].trip_id
        const window_id = `${trip_id}_A_${t_start}`
        windows.push({ window_id, trip_id, t_start, t_end, samples: bucket })
    }

    return windows
}

// ── processAudioTrip: ONE AudioProcessor instance persists across all windows ─
function processAudioTrip(tripId: string): AudioEvent[] {
    const csvLoader = new CsvLoader()
    const tripFilePath = path.join(__dirname, `../data/${tripId}_audio_data.csv`)

    if (!fs.existsSync(tripFilePath)) {
        console.warn(`No audio data file found for trip ${tripId} at ${tripFilePath}`)
        return []
    }

    const audioLoader = new AudioLoader(csvLoader, tripFilePath)
    const samples = audioLoader.getForTrip(tripId)

    if (samples.length === 0) return []

    const windows = buildAudioWindows(samples, 30)

    // CRITICAL: create ONE processor outside loop to preserve tracker state
    const processor = new AudioProcessor()
    processor.reset()

    const events: AudioEvent[] = []
    for (const window of windows) {
        const event = processor.processWindow(window)
        if (event !== null) {
            events.push(event)
        }
    }

    eventStore.clearAudio(tripId)
    eventStore.saveAudioMany(events)

    return events
}

// GET /api/audio/:tripId
router.get('/:tripId', (req: Request, res: Response) => {
    const { tripId } = req.params
    try {
        const events = processAudioTrip(tripId)
        res.json(events)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to process audio trip' })
    }
})

// GET /api/audio/:tripId/stream  (SSE — 600ms intervals)
router.get('/:tripId/stream', (req: Request, res: Response) => {
    const { tripId } = req.params

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    let events: AudioEvent[]
    try {
        events = processAudioTrip(tripId)
    } catch (err) {
        console.error(err)
        res.write('data: ERROR\n\n')
        res.end()
        return
    }

    if (events.length === 0) {
        res.write('data: DONE\n\n')
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
        res.write(`data: ${JSON.stringify(events[index])}\n\n`)
        index++
    }, 600)

    req.on('close', () => clearInterval(interval))
})

export default router
