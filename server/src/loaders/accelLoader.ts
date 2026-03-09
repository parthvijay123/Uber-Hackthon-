import { CsvLoader } from './csvLoader'
import { AccelSample } from '../../../shared/types'

export class AccelLoader {
    private cache: AccelSample[] | null = null

    constructor(
        private csvLoader: CsvLoader,
        private filePaths: string | string[]
    ) { }

    loadAll(): AccelSample[] {
        if (this.cache) return this.cache

        const paths = Array.isArray(this.filePaths) ? this.filePaths : [this.filePaths]

        const mapper = (row: any): AccelSample => ({
            sensor_id: row['accel_id'] ?? '',
            trip_id: row['trip_id'] ?? '',
            timestamp: row['timestamp'] ?? '',
            elapsed_s: parseFloat(row['elapsed_seconds'] ?? '0'),
            ax: parseFloat(row['acc_x_m_s2'] ?? '0'),
            ay: parseFloat(row['acc_y_m_s2'] ?? '0'),
            az: parseFloat(row['acc_z_m_s2'] ?? '0'),
            speed_kmh: parseFloat(row['speed_kmh'] ?? '0'),
            gps_lat: 0,
            gps_lon: 0,
        })

        this.cache = paths.flatMap(p => this.csvLoader.parseWithHeaders<AccelSample>(p, mapper))
        return this.cache
    }

    getForTrip(tripId: string): AccelSample[] {
        return this.loadAll().filter((s) => s.trip_id === tripId)
    }

    getAvailableTrips(): string[] {
        const all = this.loadAll()
        const unique = [...new Set(all.map((s) => s.trip_id))]
        return unique
    }
}