import { v4 as uuid } from 'uuid'
import {
    AudioEvent,
    FlagEvent,
    FlagSeverity,
    FlagType,
    MotionEvent,
    MotionClass,
} from '../shared/types'

/**
 * FusionEvaluator — Real-life conflict detection.
 *
 * Conflict logic (real-world basis):
 *   A "conflict moment" is when a harsh/collision motion event and a significant
 *   audio spike occur within the SAME 15-second driving window.
 *   This mirrors IRL: a harsh brake often co-occurs with passenger panic sounds,
 *   horn honking, or tire screach. Both signals together are MORE significant than
 *   either alone — the combined score is boosted by a synergy multiplier.
 *
 * Lone events:
 *   - motion_only: harsh braking / collision with no audio corroboration
 *   - audio_only: raised cabin noise without physical motion anomaly (e.g. argument)
 *
 * Severity thresholds:
 *   - high   : combined_score >= 0.72
 *   - medium : combined_score >= 0.50
 *   - low    : combined_score <  0.50
 */
export class FusionEvaluator {

    // Max seconds between motion t_start and audio elapsed_s for conflict pairing
    private readonly CONFLICT_WINDOW_S = 15

    // Minimum scores to be "significant enough" to generate any flag
    private readonly MIN_AUDIO_SCORE = 0.30
    private readonly MIN_MOTION_SCORE = 0.30

    evaluate(
        motionEvents: MotionEvent[],
        audioEvents: AudioEvent[],
        tripId: string,
        driverId: string = 'DRV001'
    ): FlagEvent[] {

        // Only flag non-normal motion events above threshold
        const significantMotion = motionEvents.filter(
            (e) => e.score > this.MIN_MOTION_SCORE && e.event_type !== MotionClass.normal
        )

        // Only flag audio events with real severity (above threshold)
        const significantAudio = audioEvents.filter(
            (e) => this.audioScore(e) > this.MIN_AUDIO_SCORE
        )

        const matchedMotionIds = new Set<string>()
        const matchedAudioIds = new Set<string>()
        const results: FlagEvent[] = []

        // ── Pass 1: Pair concurrent motion+audio = conflict_moment ──────────────
        for (const motionEvent of significantMotion) {

            const candidates = significantAudio.filter(
                (a) =>
                    !matchedAudioIds.has(a.event_id) &&
                    Math.abs(a.elapsed_s - motionEvent.elapsed_s) <= this.CONFLICT_WINDOW_S
            )

            if (candidates.length > 0) {
                const closest = candidates.reduce((best, cur) =>
                    Math.abs(cur.elapsed_s - motionEvent.elapsed_s) <
                        Math.abs(best.elapsed_s - motionEvent.elapsed_s)
                        ? cur
                        : best
                )

                results.push(
                    this.buildFlagEvent(tripId, driverId, motionEvent, closest, FlagType.conflict_moment)
                )
                matchedMotionIds.add(motionEvent.event_id)
                matchedAudioIds.add(closest.event_id)
            }
        }


        for (const motionEvent of significantMotion) {
            if (!matchedMotionIds.has(motionEvent.event_id)) {
                results.push(
                    this.buildFlagEvent(tripId, driverId, motionEvent, null, FlagType.motion_only)
                )
            }
        }


        for (const audioEvent of significantAudio) {
            if (!matchedAudioIds.has(audioEvent.event_id)) {
                results.push(
                    this.buildFlagEvent(tripId, driverId, null, audioEvent, FlagType.audio_only)
                )
            }
        }

        results.sort((a, b) => a.elapsed_s - b.elapsed_s)
        return results
    }

    /**
     * Converts audio event to a 0-1 danger score.
     * Reflects real-world: sustained high-dB noise in a vehicle cabin is
     * significantly more dangerous than a brief spike.
     */
    private audioScore(event: AudioEvent): number {
        const severityBase: Record<string, number> = {
            SHORT_LOW: 0.12,
            SHORT_MODERATE: 0.35,
            SHORT_HIGH: 0.55,
            SHORT_CRITICAL: 0.70,
            MODERATE_SPIKE: 0.60,
            HIGH_SPIKE: 0.78,
            CRITICAL_SPIKE: 0.92,
        }
        const base = severityBase[event.severity] ?? 0.25
        // Sustained events (> 5s at high dB) are more dangerous
        const sustainedBoost = event.is_sustained ? 0.08 : 0
        return Math.min(1.0, base + sustainedBoost)
    }

    private buildFlagEvent(
        tripId: string,
        driverId: string,
        motionEvent: MotionEvent | null,
        audioEvent: AudioEvent | null,
        flagType: FlagType
    ): FlagEvent {
        const motion_score = motionEvent?.score ?? 0
        const audio_score = audioEvent ? this.audioScore(audioEvent) : 0

        let combined_score: number
        switch (flagType) {
            case FlagType.conflict_moment:
                // Real-life: simultaneous harsh motion + audio is disproportionately risky.
                // Synergy boost: the combined signal is 15% more severe than weighted average.
                combined_score = Math.min(1.0,
                    (0.55 * motion_score + 0.45 * audio_score) * 1.15
                )
                break
            case FlagType.motion_only:
                combined_score = motion_score
                break
            case FlagType.audio_only:
                combined_score = audio_score * 0.90  // Slightly discounted without motion corroboration
                break
        }

        const severity: FlagSeverity =
            combined_score >= 0.72
                ? FlagSeverity.high
                : combined_score >= 0.50
                    ? FlagSeverity.medium
                    : FlagSeverity.low

        // Human-readable explanations
        let explanation: string
        let context: string
        switch (flagType) {
            case FlagType.conflict_moment:
                const timeDiff = Math.abs((audioEvent!.elapsed_s) - motionEvent!.elapsed_s).toFixed(0)
                explanation = `⚡ ${motionEvent!.explanation} simultaneous with ${audioEvent!.audio_class} audio (${audioEvent!.peak_db.toFixed(0)} dB peak, ${audioEvent!.duration_s.toFixed(0)}s) — ${timeDiff}s apart`
                context = `Motion: ${motionEvent!.event_type} | Audio: ${audioEvent!.audio_class}`
                break
            case FlagType.motion_only:
                explanation = `🚗 ${motionEvent!.explanation} — no correlated audio elevation detected`
                context = `Motion: ${motionEvent!.event_type} | Audio: normal`
                break
            case FlagType.audio_only:
                explanation = `🔊 ${audioEvent!.audio_class} audio spike (${audioEvent!.peak_db.toFixed(0)} dB, ${audioEvent!.duration_s.toFixed(0)}s)${audioEvent!.is_sustained ? ' — sustained' : ''} — no harsh motion detected`
                context = `Motion: normal | Audio: ${audioEvent!.audio_class}`
                break
        }

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
            driver_id: driverId,
            timestamp,
            elapsed_s,
            flag_type: flagType,
            severity,
            motion_score,
            audio_score,
            combined_score: Math.min(1, combined_score!),
            explanation,
            context,
            motion_event_id: motionEvent?.event_id ?? null,
            audio_event_id: audioEvent?.event_id ?? null,
        }
    }
}
