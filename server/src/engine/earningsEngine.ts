import fs from 'fs'
const csvParser = require('csv-parser')
import { DriverGoal, VelocityLog, PastTripInfo, DriverDashboardData } from '../../../shared/types'

export class EarningsLoader {
    private goalsMap = new Map<string, DriverGoal>()
    private velocityMap = new Map<string, VelocityLog[]>()
    private userTripsMap = new Map<string, PastTripInfo[]>()

    constructor(
        private goalsPath: string,
        private logsPath: string,
        private tripsPath: string
    ) { }

    public async loadData(): Promise<void> {
        await Promise.all([
            this.loadGoals(),
            this.loadVelocityLogs(),
            this.loadPastTrips()
        ])
    }

    private loadGoals(): Promise<void> {
        return new Promise((resolve, reject) => {
            const tempGoals: DriverGoal[] = []
            fs.createReadStream(this.goalsPath)
                .pipe(csvParser())
                .on('data', (row) => {
                    const goal: DriverGoal = {
                        goal_id: row.goal_id,
                        driver_id: row.driver_id,
                        date: row.date,
                        shift_start_time: row.shift_start_time,
                        shift_end_time: row.shift_end_time,
                        target_earnings: parseFloat(row.target_earnings),
                        target_hours: parseFloat(row.target_hours),
                        current_earnings: parseFloat(row.current_earnings),
                        current_hours: parseFloat(row.current_hours),
                        status: row.status as any,
                        earnings_velocity: parseFloat(row.earnings_velocity),
                        goal_completion_forecast: row.goal_completion_forecast as any
                    }
                    this.goalsMap.set(goal.driver_id, goal)
                })
                .on('end', () => resolve())
                .on('error', reject)
        })
    }

    private loadVelocityLogs(): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.createReadStream(this.logsPath)
                .pipe(csvParser())
                .on('data', (row) => {
                    const log: VelocityLog = {
                        log_id: row.log_id,
                        driver_id: row.driver_id,
                        date: row.date,
                        timestamp: row.timestamp,
                        cumulative_earnings: parseFloat(row.cumulative_earnings),
                        elapsed_hours: parseFloat(row.elapsed_hours),
                        current_velocity: parseFloat(row.current_velocity),
                        target_velocity: parseFloat(row.target_velocity),
                        velocity_delta: parseFloat(row.velocity_delta),
                        trips_completed: parseInt(row.trips_completed, 10),
                        forecast_status: row.forecast_status as any
                    }

                    if (!this.velocityMap.has(log.driver_id)) {
                        this.velocityMap.set(log.driver_id, [])
                    }
                    this.velocityMap.get(log.driver_id)!.push(log)
                })
                .on('end', () => {
                    // Sort logs chronologically per driver
                    for (const [, logs] of this.velocityMap.entries()) {
                        logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    }
                    resolve()
                })
                .on('error', reject)
        })
    }

    private loadPastTrips(): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.createReadStream(this.tripsPath)
                .pipe(csvParser())
                .on('data', (row) => {
                    const trip: PastTripInfo = {
                        trip_id: row.trip_id,
                        driver_id: row.driver_id,
                        date: row.date,
                        start_time: row.start_time,
                        end_time: row.end_time,
                        duration_min: parseFloat(row.duration_min),
                        distance_km: parseFloat(row.distance_km),
                        fare: parseFloat(row.fare),
                        surge_multiplier: parseFloat(row.surge_multiplier),
                        pickup_location: row.pickup_location,
                        dropoff_location: row.dropoff_location,
                        trip_status: row.trip_status
                    }
                    if (!this.userTripsMap.has(trip.driver_id)) {
                        this.userTripsMap.set(trip.driver_id, [])
                    }
                    this.userTripsMap.get(trip.driver_id)!.push(trip)
                })
                .on('end', () => {
                    for (const [, trips] of this.userTripsMap.entries()) {
                        // Sort most recent first based on start_time
                        trips.sort((a, b) => {
                            const timeA = a.start_time.split(':').map(Number)
                            const timeB = b.start_time.split(':').map(Number)
                            const tA = timeA[0] * 60 + timeA[1]
                            const tB = timeB[0] * 60 + timeB[1]
                            return tB - tA
                        })
                    }
                    resolve()
                })
                .on('error', reject)
        })
    }

    public getDriverDashboardData(driverId: string): DriverDashboardData | null {
        const goal = this.goalsMap.get(driverId) || null
        const velocityLogs = this.velocityMap.get(driverId) || []
        const recentTrips = this.userTripsMap.get(driverId) || []

        return {
            driverId,
            goal,
            velocityLogs,
            recentTrips,
            totalFlagsToday: 0 // Will aggregate from fusion API in the controller wrapper
        }
    }
}
