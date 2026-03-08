import * as fs from 'fs'
import * as path from 'path'
import { CsvLoader } from './csvLoader'

export class DataPreprocessor {
    static run() {
        console.log("--- Starting TypeScript Data Preprocessor ---")
        const csvLoader = new CsvLoader()

        const tripsFile = path.resolve(__dirname, '../data/trips.csv')
        const accelFile = path.resolve(__dirname, '../data/accelerometer_data.csv')
        const audioFile = path.resolve(__dirname, '../data/TRIP001_disturbance_windows.csv')

        const cleanAccelFile = path.resolve(__dirname, '../data/clean_accelerometer.csv')
        const cleanAudioFile = path.resolve(__dirname, '../data/clean_audio.csv')

        // 1. Process Trips to get absolute time boundaries
        const tripsRaw = csvLoader.parseWithHeaders<any>(tripsFile, row => row)
        const tripsMap = new Map<string, { startMs: number, endMs: number }>()

        for (const t of tripsRaw) {
            // "2024-02-06" vs "06-02-2024" matching from accel file
            const startStr = `${t.date}T${t.start_time}Z`
            const startMs = new Date(startStr).getTime()
            const durationMin = parseFloat(t.duration_min || '0')
            const endMs = startMs + durationMin * 60000
            tripsMap.set(t.trip_id, { startMs, endMs })
        }

        // 2. Process Accelerometer
        console.log("Processing Accelerometer Data...")
        const accelRaw = csvLoader.parseWithHeaders<any>(accelFile, row => row)
        const initialAccelCount = accelRaw.length

        // Helper to parse `06-02-2024 06:00:00` or `2024-02-06 06:00:00`
        const parseDate = (ts: string) => {
            if (!ts) return 0
            if (ts.includes('-')) {
                const parts = ts.split(' ')
                const dmy = parts[0].split('-')
                if (dmy.length === 3) {
                    // if year is first: 2024-02-06
                    if (dmy[0].length === 4) {
                        return new Date(`${dmy[0]}-${dmy[1]}-${dmy[2]}T${parts[1] || '00:00:00'}Z`).getTime()
                    }
                    // if day is first: 06-02-2024 (convert to YYYY-MM-DD)
                    return new Date(`${dmy[2]}-${dmy[1]}-${dmy[0]}T${parts[1] || '00:00:00'}Z`).getTime()
                }
            }
            return new Date(ts + 'Z').getTime()
        }

        // Helper to normalize the mock timestamps. 
        // The mock CSVs have all sensor data starting arbitrarily at "06:00:00" even if the trip starts at "06:45:00".
        // Instead of strict time filtering which drops 100% of the offset mock data, we will ALIGN the sensor data 
        // using the elapsed_seconds property, treating the trip startMs as elapsed_seconds = 0

        let accelClean = accelRaw.filter((row) => {
            const trip = tripsMap.get(row.trip_id)
            if (!trip) return false
            const elapsed = parseFloat(row.elapsed_seconds)
            const tMs = trip.startMs + (elapsed * 1000)

            // Re-write the row's timestamp mapping
            row.timestamp = new Date(tMs).toISOString().replace('.000Z', 'Z')

            return tMs >= trip.startMs && tMs <= trip.endMs
        })

        const postTimeAccelCount = accelClean.length

        // Filter validity and Map to new headers (e.g. accel_x -> acc_x_m_s2)
        const finalAccelData: any[] = []
        for (const row of accelClean) {
            const ax = parseFloat(row.acc_x_m_s2)
            const ay = parseFloat(row.acc_y_m_s2)
            const az = parseFloat(row.acc_z_m_s2)

            if (isNaN(ax) || isNaN(ay) || isNaN(az)) continue
            if (Math.abs(ax) > 980 || Math.abs(ay) > 980 || Math.abs(az) > 980) continue

            finalAccelData.push({
                accel_id: row.accel_id,
                trip_id: row.trip_id,
                timestamp: row.timestamp,
                elapsed_seconds: row.elapsed_seconds,
                acc_x_m_s2: ax,
                acc_y_m_s2: ay,
                acc_z_m_s2: az,
                speed_kmh: row.speed_kmh,
                gps_lat: row.gps_lat || 0,
                gps_lon: row.gps_lon || 0
            })
        }

        // Simulate low-pass filter (rolling window of 3)
        // Group by trip
        const accelByTrip = new Map<string, any[]>()
        for (const r of finalAccelData) {
            if (!accelByTrip.has(r.trip_id)) accelByTrip.set(r.trip_id, [])
            accelByTrip.get(r.trip_id)!.push(r)
        }

        const smoothedAccelData: any[] = []
        for (const [trip, rows] of accelByTrip.entries()) {
            // sort by elapsed_seconds
            rows.sort((a, b) => parseFloat(a.elapsed_seconds) - parseFloat(b.elapsed_seconds))
            for (let i = 0; i < rows.length; i++) {
                const smoothed = { ...rows[i] }
                if (rows.length >= 3) {
                    const window = []
                    if (i > 0) window.push(rows[i - 1])
                    window.push(rows[i])
                    if (i < rows.length - 1) window.push(rows[i + 1])

                    smoothed.acc_x_m_s2 = window.reduce((sum, r) => sum + r.acc_x_m_s2, 0) / window.length
                    smoothed.acc_y_m_s2 = window.reduce((sum, r) => sum + r.acc_y_m_s2, 0) / window.length
                    smoothed.acc_z_m_s2 = window.reduce((sum, r) => sum + r.acc_z_m_s2, 0) / window.length
                }
                smoothedAccelData.push(smoothed)
            }
        }

        // Write to CSV
        if (smoothedAccelData.length > 0) {
            const accelHeaders = Object.keys(smoothedAccelData[0]).join(',')
            const accelRows = smoothedAccelData.map(r => Object.values(r).join(',')).join('\n')
            fs.writeFileSync(cleanAccelFile, `${accelHeaders}\n${accelRows}`)
        }

        console.log(`Initial accel: ${initialAccelCount}, Post-time: ${postTimeAccelCount}, Final: ${smoothedAccelData.length}`)
        console.log(`Saved to ${cleanAccelFile}`)

        // 3. Process Audio
        console.log("Processing Audio Data...")
        const audioRaw = csvLoader.parseWithHeaders<any>(audioFile, row => row)
        const initialAudioCount = audioRaw.length

        let audioClean = audioRaw.filter(row => {
            const trip = tripsMap.get(row.trip_id)
            if (!trip) return false

            const elapsed = parseFloat(row.elapsed_seconds)
            const tMs = trip.startMs + (elapsed * 1000)
            row.timestamp = new Date(tMs).toISOString().replace('.000Z', 'Z')

            return tMs >= trip.startMs && tMs <= trip.endMs
        })

        const postTimeAudioCount = audioClean.length

        const finalAudioData: any[] = []
        for (const row of audioClean) {
            const db = parseFloat(row.audio_level_db)
            if (isNaN(db) || db <= 0 || db >= 150) continue
            finalAudioData.push({
                audio_id: row.audio_id,
                trip_id: row.trip_id,
                timestamp: row.timestamp,
                elapsed_seconds: row.elapsed_seconds,
                audio_level_db: db
            })
        }

        // Write Audio
        if (finalAudioData.length > 0) {
            const audioHeaders = Object.keys(finalAudioData[0]).join(',')
            const audioRows = finalAudioData.map(r => Object.values(r).join(',')).join('\n')
            fs.writeFileSync(cleanAudioFile, `${audioHeaders}\n${audioRows}`)
        }

        console.log(`Initial audio: ${initialAudioCount}, Post-time: ${postTimeAudioCount}, Final: ${finalAudioData.length}`)
        console.log(`Saved to ${cleanAudioFile}`)
        console.log("--- Preprocessing Finished ---")
    }
}
