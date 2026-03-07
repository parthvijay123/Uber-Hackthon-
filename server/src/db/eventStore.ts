import { MotionEvent } from '../../../shared/types'

export class EventStore {
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
}
