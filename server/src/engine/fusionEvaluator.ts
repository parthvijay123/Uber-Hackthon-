import { v4 as uuid } from 'uuid'
import {
    AudioEvent,
    FlagEvent,
    FlagSeverity,
    FlagType,
    MotionEvent,
    MotionClass,
} from '../../../shared/types'

// ─── FusionEvaluator ─────────────────────────────────────────────────────────

export class FusionEvaluator {
    // Events within this window of each other are considered correlated
    private readonly OVERLAP_TOLERANCE_S = 30
    // Minimum scores to be "significant" before fusion
    private readonly MIN_AUDIO_SCORE = 0.45
    private readonly MIN_MOTION_SCORE = 0.45

    evaluate(
        motionEvents: MotionEvent[],
        audioEvents: AudioEvent[],
        tripId: string
    ): FlagEvent[] {
        // 1. Filter to significant events only
        const significantMotion = motionEvents.filter(
            (e) => e.score > this.MIN_MOTION_SCORE && e.event_type !== MotionClass.normal
        )
        const significantAudio = audioEvents.filter(
            (e) => this.audioScore(e) > this.MIN_AUDIO_SCORE
        )

        const matchedMotionIds = new Set<string>()
        const matchedAudioIds = new Set<string>()
        const results: FlagEvent[] = []

        // 2. Match phase — find overlapping pairs
        for (const motionEvent of significantMotion) {
            // Find all audio events within OVERLAP_TOLERANCE_S seconds
            const candidates = significantAudio.filter(
                (a) =>
                    !matchedAudioIds.has(a.event_id) &&
                    Math.abs(a.elapsed_s - motionEvent.elapsed_s) <= this.OVERLAP_TOLERANCE_S
            )

            if (candidates.length > 0) {
                // Take closest match by elapsed_s
                const closest = candidates.reduce((best, cur) =>
                    Math.abs(cur.elapsed_s - motionEvent.elapsed_s) <
                        Math.abs(best.elapsed_s - motionEvent.elapsed_s)
                        ? cur
                        : best
                )

                results.push(
                    this.buildFlagEvent(tripId, motionEvent, closest, FlagType.conflict_moment)
                )
                matchedMotionIds.add(motionEvent.event_id)
                matchedAudioIds.add(closest.event_id)
            }
        }

        // 3. Unmatched motion → motion_only
        for (const motionEvent of significantMotion) {
            if (!matchedMotionIds.has(motionEvent.event_id)) {
                results.push(
                    this.buildFlagEvent(tripId, motionEvent, null, FlagType.motion_only)
                )
            }
        }

        // 4. Unmatched audio → audio_only
        for (const audioEvent of significantAudio) {
            if (!matchedAudioIds.has(audioEvent.event_id)) {
                results.push(
                    this.buildFlagEvent(tripId, null, audioEvent, FlagType.audio_only)
                )
            }
        }

        // 5. Sort by elapsed_s ascending
        results.sort((a, b) => a.elapsed_s - b.elapsed_s)

        return results
    }

    // ── Audio score helper (converts severity to 0–1) ────────────────────────

    private audioScore(event: AudioEvent): number {
        // Map the audio severity to a rough 0–1 score for filtering
        const severityScores: Record<string, number> = {
            SHORT_LOW: 0.15,
            SHORT_MODERATE: 0.40,
            SHORT_HIGH: 0.60,
            SHORT_CRITICAL: 0.75,
            MODERATE_SPIKE: 0.65,
            HIGH_SPIKE: 0.80,
            CRITICAL_SPIKE: 0.95,
        }
        return severityScores[event.severity] ?? 0.3
    }

    // ── Build a FlagEvent ─────────────────────────────────────────────────────

    private buildFlagEvent(
        tripId: string,
        motionEvent: MotionEvent | null,
        audioEvent: AudioEvent | null,
        flagType: FlagType
    ): FlagEvent {
        const motion_score = motionEvent?.score ?? 0
        const audio_score = audioEvent ? this.audioScore(audioEvent) : 0

        let combined_score: number
        switch (flagType) {
            case FlagType.conflict_moment:
                combined_score = 0.6 * motion_score + 0.4 * audio_score
                break
            case FlagType.motion_only:
                combined_score = motion_score
                break
            case FlagType.audio_only:
                combined_score = audio_score
                break
        }

        const severity: FlagSeverity =
            combined_score > 0.75
                ? FlagSeverity.high
                : combined_score > 0.5
                    ? FlagSeverity.medium
                    : FlagSeverity.low

        // Explanation
        let explanation: string
        switch (flagType) {
            case FlagType.conflict_moment:
                explanation = `Combined signal: ${motionEvent!.explanation} + ${audioEvent!.audio_class} audio (${audioEvent!.peak_db.toFixed(1)} dB) for ${audioEvent!.duration_s.toFixed(1)}s`
                break
            case FlagType.motion_only:
                explanation = `${motionEvent!.explanation} (no correlated audio elevation)`
                break
            case FlagType.audio_only:
                explanation = `${audioEvent!.audio_class} audio (${audioEvent!.peak_db.toFixed(1)} dB) for ${audioEvent!.duration_s.toFixed(1)}s (no correlated motion event)`
                break
        }

        // Context
        let context: string
        switch (flagType) {
            case FlagType.conflict_moment:
                context = `Motion: ${motionEvent!.event_type} | Audio: ${audioEvent!.audio_class}`
                break
            case FlagType.motion_only:
                context = `Motion: ${motionEvent!.event_type} | Audio: normal`
                break
            case FlagType.audio_only:
                context = `Motion: normal | Audio: ${audioEvent!.audio_class}`
                break
        }

        // Use the earlier timestamp / elapsed_s of the two events
        const timestamp =
            motionEvent && audioEvent
                ? motionEvent.elapsed_s <= audioEvent.elapsed_s
                    ? motionEvent.timestamp
                    : audioEvent.timestamp
                : motionEvent?.timestamp ?? audioEvent?.timestamp ?? ''

        const elapsed_s =
            motionEvent && audioEvent
                ? Math.min(motionEvent.elapsed_s, audioEvent.elapsed_s)
                : motionEvent?.elapsed_s ?? audioEvent?.elapsed_s ?? 0

        return {
            flag_id: uuid(),
            trip_id: tripId,
            driver_id: 'DEMO_DRIVER',
            timestamp,
            elapsed_s,
            flag_type: flagType,
            severity,
            motion_score,
            audio_score,
            combined_score: Math.min(1, combined_score),
            explanation,
            context,
            motion_event_id: motionEvent?.event_id ?? null,
            audio_event_id: audioEvent?.event_id ?? null,
        }
    }
}
