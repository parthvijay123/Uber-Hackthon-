import * as path from 'path'
import { CsvLoader } from './csvLoader'
import { AccelSample } from '../../../shared/types'

export class AccelLoader {
    constructor(
        private csvLoader: CsvLoader,
        private filePath: string
    ) { }

    loadAll(): AccelSample[] {
        return this.csvLoader.parseWithHeaders<AccelSample>(
            this.filePath,
            (row) => ({
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
        )
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