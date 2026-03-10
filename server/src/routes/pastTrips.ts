/**
 * pastTrips.ts — Serve past trips from the trips.csv file, filtered by driver ID.
 * Also attempts to enrich each trip with flag_count from the DB (for demo trips).
 *
 * GET /api/past-trips/:driverId  → returns all trips for the given driver from trips.csv
 */
import { Router, Request, Response } from 'express'
import * as path from 'path'
import * as fs from 'fs'
import pool from '../db/mysqlClient'

const router = Router()
const DATA_DIR = path.join(__dirname, '../data')
const TRIPS_CSV = path.join(DATA_DIR, 'trips.csv')

interface TripRow {
    trip_id: string
    driver_id: string
    date: string
    start_time: string
    end_time: string
    duration_min: string
    distance_km: string
    fare: string
    surge_multiplier: string
    pickup_location: string
    dropoff_location: string
    trip_status: string
}

function parseTripsCSV(): TripRow[] {
    const content = fs.readFileSync(TRIPS_CSV, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim() !== '')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/\r/g, ''))
    const rows: TripRow[] = []

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/\r/g, ''))
        if (cols.length < headers.length) continue
        const obj: any = {}
        headers.forEach((h, idx) => { obj[h] = cols[idx] ?? '' })
        rows.push(obj as TripRow)
    }
    return rows
}

// GET /api/past-trips/:driverId
router.get('/:driverId', async (req: Request, res: Response) => {
    const { driverId } = req.params
    try {
        const allTrips = parseTripsCSV()
        const driverTrips = allTrips
            .filter(t => t.driver_id.toLowerCase() === driverId.toLowerCase())
            .map(t => ({
                trip_id: t.trip_id,
                driver_id: t.driver_id,
                date: t.date,
                start_time: t.start_time,
                end_time: t.end_time,
                duration_min: parseFloat(t.duration_min),
                distance_km: parseFloat(t.distance_km),
                fare: parseFloat(t.fare),
                surge_multiplier: parseFloat(t.surge_multiplier),
                pickup_location: t.pickup_location,
                dropoff_location: t.dropoff_location,
                trip_status: t.trip_status,
                flag_count: 0,
                stress_score: null as number | null,
                trip_rating: null as string | null,
            }))

        if (driverTrips.length === 0) {
            return res.json([])
        }

        // Enrich with DB data (flag counts + stress scores from trip_summaries)
        // Only demo trips (TRIP221/222/223) will have DB rows — others get 0/null
        try {
            const tripIds = driverTrips.map(t => t.trip_id)
            const placeholders = tripIds.map(() => '?').join(',')

            const [flagRows]: any = await pool.query(
                `SELECT trip_id, COUNT(*) as cnt FROM flag_events WHERE trip_id IN (${placeholders}) GROUP BY trip_id`,
                tripIds
            )
            const flagMap = new Map<string, number>(flagRows.map((r: any) => [r.trip_id, parseInt(r.cnt)]))

            const [summaryRows]: any = await pool.query(
                `SELECT trip_id, stress_score, trip_quality_rating FROM trip_summaries WHERE trip_id IN (${placeholders})`,
                tripIds
            )
            const summaryMap = new Map<string, { stress_score: number, trip_quality_rating: string }>(
                summaryRows.map((r: any) => [r.trip_id, {
                    stress_score: parseFloat(r.stress_score),
                    trip_quality_rating: r.trip_quality_rating,
                }])
            )

            for (const t of driverTrips) {
                t.flag_count = flagMap.get(t.trip_id) ?? 0
                const summary = summaryMap.get(t.trip_id)
                if (summary) {
                    t.stress_score = summary.stress_score
                    t.trip_rating = summary.trip_quality_rating
                }
            }
        } catch (dbErr: any) {
            // DB unavailable — return CSV data without enrichment
            console.warn('[PastTrips] DB enrichment failed (non-fatal):', dbErr.message)
        }

        res.json(driverTrips)
    } catch (err: any) {
        console.error('[PastTrips] Error reading CSV:', err.message)
        res.status(500).json({ error: 'Failed to load past trips' })
    }
})

export default router
