import { useState, useEffect } from 'react'
import { DriverDashboardData, VelocityLog } from '../../../shared/types'

interface MasterDashboardProps {
    driverId: string
    onSelectTrip: (tripId: string) => void
    onLayoutUpdate: () => void
}

const API_BASE = 'http://localhost:3001/api'

export default function MasterDashboard({ driverId, onSelectTrip, onLayoutUpdate }: MasterDashboardProps) {
    const [data, setData] = useState<DriverDashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        fetch(`${API_BASE}/driver/${driverId}/dashboard`)
            .then(res => {
                if (!res.ok) throw new Error('Data not found')
                return res.json()
            })
            .then(d => {
                setData(d)
                setLoading(false)
                onLayoutUpdate()
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [driverId, onLayoutUpdate])

    if (loading) {
        return <div className="loading-state">Loading dashboard data...</div>
    }

    if (!data || !data.goal) {
        return <div className="error-state">Driver profile {driverId} not found.</div>
    }

    const { goal, recentTrips, velocityLogs } = data

    // Determine latest velocity state
    let latestLog: VelocityLog | null = null
    if (velocityLogs.length > 0) {
        latestLog = velocityLogs[velocityLogs.length - 1]
    }

    const goalPercent = Math.min(100, Math.round((goal.current_earnings / goal.target_earnings) * 100))
    const isAhead = latestLog?.forecast_status === 'ahead' || goal.goal_completion_forecast === 'ahead'
    const isAtRisk = latestLog?.forecast_status === 'at_risk' || goal.goal_completion_forecast === 'at_risk'

    let statusClass = 'on-track'
    if (isAhead) statusClass = 'ahead'
    if (isAtRisk) statusClass = 'at-risk'

    return (
        <div className="dashboard-grid">

            {/* Top row: Velocity Overview */}
            <div className={`card velocity-card ${statusClass}`}>
                <div className="card-title">Earnings Velocity</div>
                <div className="velocity-main">
                    <div className="velocity-metric">
                        <span className="v-label">Current Velocity</span>
                        <span className="v-value">${latestLog?.current_velocity.toFixed(2) || goal.earnings_velocity.toFixed(2)}/hr</span>
                    </div>
                    <div className="velocity-divider"></div>
                    <div className="velocity-metric">
                        <span className="v-label">Target Velocity</span>
                        <span className="v-value">${latestLog?.target_velocity.toFixed(2) || (goal.target_earnings / goal.target_hours).toFixed(2)}/hr</span>
                    </div>
                </div>

                <div className="goal-progress-container">
                    <div className="goal-text">
                        <span>Goal Progress: ${goal.current_earnings} / ${goal.target_earnings}</span>
                        <span>{goalPercent}%</span>
                    </div>
                    <div className="progress-bar-bg">
                        <div className={`progress-bar-fill ${statusClass}`} style={{ width: `${goalPercent}%` }}></div>
                    </div>
                    <div className="forecast-text">
                        Forecast: <strong>{latestLog?.forecast_status.replace('_', ' ').toUpperCase() || goal.goal_completion_forecast.replace('_', ' ').toUpperCase()}</strong>
                    </div>
                </div>
            </div>

            {/* Bottom Row / Sidebar: Trips History */}
            <div className="card trips-card">
                <div className="card-title">Today's Trips</div>
                <p className="subtitle">Select a trip to view Edge/Cloud sensor flags.</p>
                <div className="trips-list">
                    {recentTrips.length === 0 ? (
                        <div className="empty-state">No trips recorded today.</div>
                    ) : (
                        recentTrips.map(trip => (
                            <div
                                key={trip.trip_id}
                                className="trip-row"
                                onClick={() => onSelectTrip(trip.trip_id)}
                            >
                                <div className="trip-time">{trip.start_time.slice(0, 5)}</div>
                                <div className="trip-details">
                                    <span className="trip-id">{trip.trip_id}</span>
                                    <span className="trip-loc">{trip.pickup_location} → {trip.dropoff_location}</span>
                                </div>
                                <div className="trip-fare">${trip.fare}</div>
                                <div className="trip-action">▸</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    )
}
