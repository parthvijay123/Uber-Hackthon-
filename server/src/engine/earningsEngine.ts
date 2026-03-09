import fs from 'fs'
const csvParser = require('csv-parser')
import { DriverGoal, VelocityLog, PastTripInfo, DriverDashboardData, ForecastStatus } from '../../../shared/types'

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
        this.applyForecasterLogic()
    }

    private applyForecasterLogic(): void {
        for (const [driverId, logs] of this.velocityMap.entries()) {
            const goal = this.goalsMap.get(driverId)
            if (!goal) continue

            let previousWasAtRisk = false

            for (let i = 0; i < logs.length; i++) {
                const log = logs[i]


                const targetHours = goal.target_hours > 0 ? goal.target_hours : 1
                const targetVelocity = goal.target_earnings / targetHours


                const currentVelocity = log.elapsed_hours > 0 ? log.cumulative_earnings / log.elapsed_hours : 0
                const velocityDelta = currentVelocity - targetVelocity

                log.target_velocity = targetVelocity
                log.current_velocity = currentVelocity
                log.velocity_delta = velocityDelta


                if (goal.target_earnings === 0 || log.cumulative_earnings >= goal.target_earnings) {
                    log.forecast_status = 'achieved'
                    continue
                }


                if (log.elapsed_hours >= targetHours) {
                    log.forecast_status = 'at_risk'
                    continue
                }


                let rawStatus: ForecastStatus = 'on_track'
                if (currentVelocity > targetVelocity * 1.15) {
                    rawStatus = 'ahead'
                } else if (currentVelocity < targetVelocity * 0.90) {
                    rawStatus = 'at_risk'
                }


                if (rawStatus === 'at_risk') {
                    const remainingEarnings = Math.max(0, goal.target_earnings - log.cumulative_earnings)
                    const remainingHours = Math.max(0, targetHours - log.elapsed_hours)

                    let recoveryRatio = Infinity
                    if (remainingHours > 0) {
                        const recoveryVelocity = remainingEarnings / remainingHours
                        recoveryRatio = recoveryVelocity / targetVelocity
                    }


                    if (recoveryRatio <= 1.8) {
                        rawStatus = 'on_track'
                    }
                }

                // 6. Consecutive Reading Rule
                let isActuallyAtRisk = false
                if (rawStatus === 'at_risk') {
                    if (previousWasAtRisk) {
                        isActuallyAtRisk = true
                    }
                    previousWasAtRisk = true
                } else {
                    previousWasAtRisk = false
                }

                let finalStatus = rawStatus
                if (rawStatus === 'at_risk' && !isActuallyAtRisk) {
                    finalStatus = 'on_track'
                }


                if (finalStatus === 'at_risk') {
                    let tripConf = 1
                    if (log.trips_completed < 3) tripConf = 0
                    else if (log.trips_completed <= 5) tripConf = 0.5

                    let timeConf = 1
                    if (log.elapsed_hours < 1) timeConf = 0
                    else if (log.elapsed_hours <= 2.5) timeConf = 0.5

                    const confidence = Math.min(tripConf, timeConf)
                    if (confidence < 1) {
                        finalStatus = 'warming_up'
                    }
                }

                log.forecast_status = finalStatus
            }


            if (logs.length > 0) {
                const latest = logs[logs.length - 1]
                goal.earnings_velocity = latest.current_velocity
                goal.current_earnings = latest.cumulative_earnings
                goal.current_hours = latest.elapsed_hours
                goal.goal_completion_forecast = latest.forecast_status
                if (latest.forecast_status === 'achieved') goal.status = 'achieved'
                else if (latest.forecast_status === 'at_risk') goal.status = 'at_risk'
                else goal.status = 'in_progress'
            }
        }
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
                .on('data', (row: any) => {
                    const duration = parseFloat(row.duration_min)
                    const distance = parseFloat(row.distance_km)
                    const surge = parseFloat(row.surge_multiplier)

                    // Stress Heuristic: Heavy traffic (long duration, short distance) + High Surge
                    let stressScore = 0
                    if (distance > 0) {
                        stressScore = Math.min(1.0, (duration / distance) * 0.1 * surge)
                    }

                    let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' = 'Excellent'
                    if (stressScore > 0.7) rating = 'Poor'
                    else if (stressScore > 0.5) rating = 'Fair'
                    else if (stressScore > 0.3) rating = 'Good'

                    const trip: PastTripInfo = {
                        trip_id: row.trip_id,
                        driver_id: row.driver_id,
                        date: row.date,
                        start_time: row.start_time,
                        end_time: row.end_time,
                        duration_min: duration,
                        distance_km: distance,
                        fare: parseFloat(row.fare),
                        surge_multiplier: surge,
                        pickup_location: row.pickup_location,
                        dropoff_location: row.dropoff_location,
                        trip_status: row.trip_status,
                        stress_score: stressScore,
                        trip_rating: rating
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
