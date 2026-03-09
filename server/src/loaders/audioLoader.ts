import { CsvLoader } from './csvLoader'
import { AudioSample } from '../../../shared/types'

export class AudioLoader {
    private cache: AudioSample[] | null = null

    constructor(
        private csvLoader: CsvLoader,
        private filePaths: string | string[]
    ) { }

    loadAll(): AudioSample[] {
        if (this.cache) return this.cache

        const paths = Array.isArray(this.filePaths) ? this.filePaths : [this.filePaths]

        const mapper = (row: any): AudioSample | null => {
            const db = parseFloat(row['audio_level_db'] ?? '')
            if (isNaN(db)) return null
            return {
                audio_id: row['audio_id'] ?? '',
                trip_id: row['trip_id'] ?? '',
                timestamp: row['timestamp'] ?? '',
                elapsed_s: parseFloat(row['elapsed_seconds'] ?? '0'),
                db_level: db,
            }
        }

        this.cache = paths
            .flatMap(p => this.csvLoader.parseWithHeaders<AudioSample | null>(p, mapper))
            .filter((s): s is AudioSample => s !== null)

        return this.cache
    }

    getForTrip(tripId: string): AudioSample[] {
        return this.loadAll()
            .filter((s) => s.trip_id === tripId)
            .sort((a, b) => a.elapsed_s - b.elapsed_s)
    }

    getAvailableTrips(): string[] {
        return [...new Set(this.loadAll().map((s) => s.trip_id))]
    }
}
