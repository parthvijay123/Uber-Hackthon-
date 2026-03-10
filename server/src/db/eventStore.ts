import { MotionEvent, AudioEvent, FlagEvent } from '../shared/types'

export class EventStore {
    // Motion store
    private store: Map<string, MotionEvent[]> = new Map()

    saveMany(events: MotionEvent[]): void {
        for (const event of events) {
            const existing = this.store.get(event.trip_id) ?? []
            existing.push(event)
            this.store.set(event.trip_id, existing)
        }
    }

    getByTrip(tripId: string): MotionEvent[] {
        return this.store.get(tripId) ?? []
    }

    clear(tripId?: string): void {
        if (tripId !== undefined) {
            this.store.delete(tripId)
        } else {
            this.store.clear()
        }
    }

    // Audio store
    private audioStore: Map<string, AudioEvent[]> = new Map()

    saveAudio(event: AudioEvent): void {
        const existing = this.audioStore.get(event.trip_id) ?? []
        existing.push(event)
        this.audioStore.set(event.trip_id, existing)
    }

    saveAudioMany(events: AudioEvent[]): void {
        for (const event of events) {
            this.saveAudio(event)
        }
    }

    getAudioByTrip(tripId: string): AudioEvent[] {
        return this.audioStore.get(tripId) ?? []
    }

    clearAudio(tripId?: string): void {
        if (tripId !== undefined) {
            this.audioStore.delete(tripId)
        } else {
            this.audioStore.clear()
        }
    }

    // Flag store
    private flagStore: Map<string, FlagEvent[]> = new Map()

    saveFlagMany(events: FlagEvent[]): void {
        for (const event of events) {
            const existing = this.flagStore.get(event.trip_id) ?? []
            existing.push(event)
            this.flagStore.set(event.trip_id, existing)
        }
    }

    getFlagsByTrip(tripId: string): FlagEvent[] {
        return this.flagStore.get(tripId) ?? []
    }

    getAllFlags(): FlagEvent[] {
        return Array.from(this.flagStore.values()).flat()
    }

    clearFlags(tripId?: string): void {
        if (tripId !== undefined) {
            this.flagStore.delete(tripId)
        } else {
            this.flagStore.clear()
        }
    }
}
