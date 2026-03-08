/**
 * TripProcessor — Phase 3 orchestrator.
 *
 * Runs motion and audio pipelines CONCURRENTLY using Promise.all, then
 * feeds the combined results into FusionEvaluator.
 *
 * TODO (production): move runMotionPipeline / runAudioPipeline into actual
 * worker_threads so CPU-bound CSV work doesn't block the event loop. At demo
 * scale the overhead is negligible, but Promise.all gives the correct async
 * API shape for a future migration.
 */

import * as path from 'path'
import { v4 as uuid } from 'uuid'
import { AccelLoader } from '../loaders/accelLoader'
import { AudioLoader } from '../loaders/audioLoader'
import { WindowBuilder } from '../engine/windowBuilder'
import { MotionProcessor } from '../engine/motionProcessor'
import { AudioProcessor } from '../engine/audioProcessor'
import { FusionEvaluator } from '../engine/fusionEvaluator'
import { EventStore } from '../db/eventStore'
import {
    AudioBatchWindow,
    AudioEvent,
    AudioSample,
    MotionEvent,
    TripAnalysisResult,
} from '../../../shared/types'

// ─── Helper: build 30-second audio batch windows ─────────────────────────────

function buildAudioWindows(
    samples: AudioSample[],
    windowSizeSeconds: number
): AudioBatchWindow[] {
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

// ─── TripProcessor ────────────────────────────────────────────────────────────

export class TripProcessor {
    constructor(
        private accelLoader: AccelLoader,
        private audioLoader: AudioLoader,
        private motionProcessor: MotionProcessor,
        private audioProcessor: AudioProcessor,
        private fusionEvaluator: FusionEvaluator,
        private eventStore: EventStore
    ) { }

    async processTrip(tripId: string): Promise<TripAnalysisResult> {
        const start = Date.now()

        // Clear stale data from any previous run (idempotency)
        this.eventStore.clear(tripId)
        this.eventStore.clearAudio(tripId)
        this.eventStore.clearFlags(tripId)

        // === CORE CONCURRENCY POINT ===
        // Both pipelines run simultaneously. The slower one determines total time.
        const [motionEvents, audioEvents] = await Promise.all([
            this.runMotionPipeline(tripId),
            this.runAudioPipeline(tripId),
        ])

        // Fusion — correlate overlapping events → FlagEvent[]
        const flagEvents = this.fusionEvaluator.evaluate(motionEvents, audioEvents, tripId)

        // Persist to EventStore for subsequent reads (no reprocessing needed)
        this.eventStore.saveMany(motionEvents)
        this.eventStore.saveAudioMany(audioEvents)
        this.eventStore.saveFlagMany(flagEvents)

        const duration_ms = Date.now() - start

        return {
            trip_id: tripId,
            motion_events: motionEvents,
            audio_events: audioEvents,
            flag_events: flagEvents,
            processed_at: new Date().toISOString(),
            duration_ms,
        }
    }

    // ── Motion pipeline ───────────────────────────────────────────────────────

    private async runMotionPipeline(tripId: string): Promise<MotionEvent[]> {
        const samples = this.accelLoader.getForTrip(tripId)
        if (samples.length === 0) return []

        const windowBuilder = new WindowBuilder()
        const windows = windowBuilder.buildWindows(samples, 15)

        const events: MotionEvent[] = []
        for (const window of windows) {
            const result = this.motionProcessor.process(window)
            const matchingSample =
                window.samples.find((s) => s.elapsed_s === window.t_start) ??
                window.samples[0]

            events.push({
                event_id: uuid(),
                trip_id: result.trip_id,
                timestamp: matchingSample?.timestamp ?? '',
                elapsed_s: result.t_start,
                event_type: result.event_type,
                magnitude: result.peak_magnitude,
                delta_speed: result.delta_speed,
                score: result.score,
                explanation: result.explanation,
            })
        }

        return events
    }

    // ── Audio pipeline ────────────────────────────────────────────────────────

    private async runAudioPipeline(tripId: string): Promise<AudioEvent[]> {
        const samples = this.audioLoader.getForTrip(tripId)
        if (samples.length === 0) return []  // TRIP002/TRIP003 have no audio — fine

        const windows = buildAudioWindows(samples, 30)

        // CRITICAL: one processor instance across all windows to preserve tracker state
        const processor = new AudioProcessor()
        processor.reset()

        const events: AudioEvent[] = []
        for (const window of windows) {
            const event = processor.processWindow(window)
            if (event !== null) {
                events.push(event)
            }
        }

        return events
    }
}
