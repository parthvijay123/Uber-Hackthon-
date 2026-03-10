import { AccelSample, BatchWindow, MotionClass, WindowResult } from '../shared/types'

export class MotionProcessor {
    process(window: BatchWindow): WindowResult {
        const peak = this.peakMagnitude(window.samples)
        const dSpeed = this.deltaSpeed(window.samples)
        const eventType = this.classifyEvent(peak, dSpeed)
        const s = this.score(peak, eventType)
        const explanation = this.buildExplanation(eventType, peak, dSpeed)

        return {
            window_id: window.window_id,
            trip_id: window.trip_id,
            t_start: window.t_start,
            t_end: window.t_end,
            peak_magnitude: peak,
            delta_speed: dSpeed,
            event_type: eventType,
            score: s,
            explanation,
        }
    }

    computeMagnitude(ax: number, ay: number, az: number): number {
        return Math.sqrt(ax * ax + ay * ay + (az - 9.8) * (az - 9.8))
    }

    peakMagnitude(samples: AccelSample[]): number {
        const mags = samples.map((s) => this.computeMagnitude(s.ax, s.ay, s.az))
        return Math.max(...mags)
    }

    deltaSpeed(samples: AccelSample[]): number {
        if (samples.length < 2) return 0
        return samples[samples.length - 1].speed_kmh - samples[0].speed_kmh
    }

    classifyEvent(magnitude: number, dSpeed: number): MotionClass {
        if (magnitude >= 5.0) return MotionClass.collision
        if (magnitude >= 2.2 && dSpeed <= -3.0) return MotionClass.harsh
        if (magnitude >= 2.2 && dSpeed >= 3.0) return MotionClass.harsh
        if (magnitude >= 1.5) return MotionClass.moderate
        return MotionClass.normal
    }

    score(magnitude: number, eventType: MotionClass): number {
        switch (eventType) {
            case MotionClass.collision:
                return 1.0
            case MotionClass.harsh:
                return Math.min(0.95, 0.7 + (magnitude - 2.2) / 10)
            case MotionClass.moderate:
                return Math.min(0.65, 0.3 + (magnitude - 1.5) / 10)
            case MotionClass.normal:
                return Math.min(0.29, magnitude / 10)
        }
    }

    buildExplanation(eventType: MotionClass, magnitude: number, dSpeed: number): string {
        const mag = magnitude.toFixed(2)
        const ds = dSpeed.toFixed(2)
        switch (eventType) {
            case MotionClass.collision:
                return `Severe impact detected: ${mag} m/s²`
            case MotionClass.harsh:
                if (dSpeed <= 0) {
                    return `Harsh braking: ${mag} m/s², speed Δ ${ds} km/h`
                }
                return `Rapid acceleration: ${mag} m/s², speed Δ ${ds} km/h`
            case MotionClass.moderate:
                return `Moderate motion: ${mag} m/s²`
            case MotionClass.normal:
                return `Normal driving`
        }
    }
}