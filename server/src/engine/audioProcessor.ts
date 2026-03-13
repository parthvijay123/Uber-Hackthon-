import { v4 as uuid } from 'uuid'
import {
    AudioBatchWindow,
    AudioClass,
    AudioEvent,
    AudioSample,
    AudioSeverity,
} from '../shared/types'

// ─── AudioSpikeTracker ────────────────────────────────────────────────────────

export class AudioSpikeTracker {
    in_spike: boolean = false
    spike_start_elapsed: number = 0
    spike_start_timestamp: string = ''
    spike_peak_db: number = 0
    spike_baseline_db: number = 0
    seconds_to_peak: number = 0

    reset(): void {
        this.in_spike = false
        this.spike_start_elapsed = 0
        this.spike_start_timestamp = ''
        this.spike_peak_db = 0
        this.spike_baseline_db = 0
        this.seconds_to_peak = 0
    }

    startSpike(
        elapsed_s: number,
        timestamp: string,
        baseline_db: number,
        current_db: number
    ): void {
        this.in_spike = true
        this.spike_start_elapsed = elapsed_s
        this.spike_start_timestamp = timestamp
        this.spike_baseline_db = baseline_db
        this.spike_peak_db = current_db
        this.seconds_to_peak = 0
    }

    updatePeak(current_db: number, elapsed_since_start: number): void {
        if (current_db > this.spike_peak_db) {
            this.spike_peak_db = current_db
            this.seconds_to_peak = elapsed_since_start
        }
    }

    getElapsed(current_elapsed_s: number): number {
        return current_elapsed_s - this.spike_start_elapsed
    }

    snapshot(): {
        in_spike: boolean
        spike_start_elapsed: number
        spike_start_timestamp: string
        spike_peak_db: number
        spike_baseline_db: number
        seconds_to_peak: number
    } {
        return {
            in_spike: this.in_spike,
            spike_start_elapsed: this.spike_start_elapsed,
            spike_start_timestamp: this.spike_start_timestamp,
            spike_peak_db: this.spike_peak_db,
            spike_baseline_db: this.spike_baseline_db,
            seconds_to_peak: this.seconds_to_peak,
        }
    }
}

// ─── AudioProcessor ──────────────────────────────────────────────────────────

export class AudioProcessor {
    private tracker: AudioSpikeTracker = new AudioSpikeTracker()
    private recentBaselines: number[] = []

    // ── Constants
    private readonly SPIKE_THRESHOLD_DB = 8       // dB above baseline to start a spike
    private readonly SPIKE_END_THRESHOLD = 5       // dB above baseline before spike ends
    private readonly BASELINE_WINDOW = 5

    // ── Minimum sustained seconds required per peak-dB level
    // Spikes that don't meet the minimum duration for their level are discarded.
    private readonly MIN_DURATION_RULES: Array<{ minDb: number; minSecs: number }> = [
        { minDb: 90, minSecs: 5 },    // ≥90 dB → must last ≥5s
        { minDb: 85, minSecs: 8 },    // ≥85 dB → must last ≥8s
        { minDb: 80, minSecs: 12 },   // ≥80 dB → must last ≥12s
        { minDb: 75, minSecs: 15 },   // ≥75 dB → must last ≥15s
        { minDb: 65, minSecs: 20 },   // ≥65 dB → must last ≥20s
        { minDb: 0, minSecs: 3 },     // anything else → must last ≥3s
    ]

    reset(): void {
        this.tracker.reset()
        this.recentBaselines = []
    }

    /**
     * Returns the minimum number of seconds a spike at `peak_db` must sustain
     * before it is considered a real event.
     */
    getMinDuration(peak_db: number): number {
        for (const rule of this.MIN_DURATION_RULES) {
            if (peak_db >= rule.minDb) return rule.minSecs
        }
        return 10
    }

    processWindow(window: AudioBatchWindow): AudioEvent | null {
        // Sort samples by elapsed_s ascending
        const samples = [...window.samples].sort((a, b) => a.elapsed_s - b.elapsed_s)

        for (const sample of samples) {
            this.updateBaseline(sample.db_level)
            const baseline = this.computeBaseline()

            if (!this.tracker.in_spike && this.isSpikeOnset(sample.db_level, baseline)) {
                this.tracker.startSpike(sample.elapsed_s, sample.timestamp, baseline, sample.db_level)
            }

            if (this.tracker.in_spike) {
                const elapsedSinceStart = this.tracker.getElapsed(sample.elapsed_s)
                this.tracker.updatePeak(sample.db_level, elapsedSinceStart)

                if (this.isSpikeEnd(sample.db_level, this.tracker.spike_baseline_db)) {
                    const duration_s = this.tracker.getElapsed(sample.elapsed_s)
                    const minRequired = this.getMinDuration(this.tracker.spike_peak_db)

                    if (duration_s >= minRequired) {
                        // Duration threshold met — emit the event
                        const event = this.buildAudioEvent(this.tracker, sample.elapsed_s, window.samples)
                        this.tracker.reset()
                        return event
                    } else {
                        // Too short for its dB level — discard silently
                        this.tracker.reset()
                    }
                }
            }
        }

        // Spike carried across window boundary — do not close
        // TODO: if trip ends while in_spike, the unresolved spike is silently dropped
        return null
    }

    updateBaseline(db: number): void {
        this.recentBaselines.push(db)
        if (this.recentBaselines.length > this.BASELINE_WINDOW) {
            this.recentBaselines.shift()
        }
    }

    computeBaseline(): number {
        if (this.recentBaselines.length === 0) return 60
        const sum = this.recentBaselines.reduce((a, b) => a + b, 0)
        return sum / this.recentBaselines.length
    }

    isSpikeOnset(current_db: number, baseline: number): boolean {
        return (current_db - baseline) > this.SPIKE_THRESHOLD_DB
    }

    isSpikeEnd(current_db: number, spike_baseline: number): boolean {
        return current_db <= spike_baseline + this.SPIKE_END_THRESHOLD
    }

    /**
     * Classify a dB level into one of the 6 audio categories.
     *
     * argument     ≥ 90 dB
     * very_loud    ≥ 85 dB
     * loud         ≥ 80 dB
     * conversation ≥ 75 dB
     * normal       ≥ 65 dB
     * quiet        < 65 dB
     */
    classifyDb(db: number): AudioClass {
        if (db >= 90) return AudioClass.argument
        if (db >= 85) return AudioClass.very_loud
        if (db >= 80) return AudioClass.loud
        if (db >= 75) return AudioClass.conversation
        if (db >= 65) return AudioClass.normal
        return AudioClass.quiet
    }

    determineSeverity(peak_db: number, duration_s: number): AudioSeverity {
        // Long sustained events
        if (peak_db >= 90 && duration_s >= 15) return AudioSeverity.CRITICAL_SPIKE
        if (peak_db >= 85 && duration_s >= 22) return AudioSeverity.HIGH_SPIKE
        if (peak_db >= 80 && duration_s >= 30) return AudioSeverity.HIGH_SPIKE
        if (peak_db >= 75 && duration_s >= 50) return AudioSeverity.MODERATE_SPIKE
        if (peak_db >= 65 && duration_s >= 30) return AudioSeverity.MODERATE_SPIKE
        // Shorter bursts (already passed minimum gate, so still reportable)
        if (peak_db >= 90) return AudioSeverity.SHORT_CRITICAL
        if (peak_db >= 85) return AudioSeverity.SHORT_HIGH
        if (peak_db >= 80) return AudioSeverity.SHORT_HIGH
        if (peak_db >= 75) return AudioSeverity.SHORT_MODERATE
        if (peak_db >= 65) return AudioSeverity.SHORT_MODERATE
        return AudioSeverity.SHORT_LOW
    }

    isSustained(peak_db: number, duration_s: number): boolean {
        if (peak_db >= 90 && duration_s >= 15) return true
        if (peak_db >= 85 && duration_s >= 22) return true
        if (peak_db >= 80 && duration_s >= 30) return true
        if (peak_db >= 75 && duration_s >= 50) return true
        if (peak_db >= 65 && duration_s >= 30) return true
        return false
    }

    buildAudioEvent(
        tracker: AudioSpikeTracker,
        end_elapsed_s: number,
        allSamples: AudioSample[]
    ): AudioEvent {
        const snap = tracker.snapshot()
        const duration_s = end_elapsed_s - snap.spike_start_elapsed
        const magnitude_db = snap.spike_peak_db - snap.spike_baseline_db
        const rate_of_change = magnitude_db / Math.max(snap.seconds_to_peak, 1)
        const audio_class = this.classifyDb(snap.spike_peak_db)
        const severity = this.determineSeverity(snap.spike_peak_db, duration_s)
        const is_sustained = this.isSustained(snap.spike_peak_db, duration_s)

        // Compute avg_db across spike samples
        const spikeSamples = allSamples.filter(
            (s) => s.elapsed_s >= snap.spike_start_elapsed && s.elapsed_s <= end_elapsed_s
        )
        const avg_db =
            spikeSamples.length > 0
                ? spikeSamples.reduce((sum, s) => sum + s.db_level, 0) / spikeSamples.length
                : snap.spike_peak_db

        return {
            event_id: uuid(),
            trip_id: allSamples[0]?.trip_id ?? '',
            timestamp: snap.spike_start_timestamp,
            elapsed_s: snap.spike_start_elapsed,
            peak_db: snap.spike_peak_db,
            avg_db,
            baseline_db: snap.spike_baseline_db,
            magnitude_db,
            duration_s,
            audio_class,
            severity,
            is_sustained,
            rate_of_change,
        }
    }
}
