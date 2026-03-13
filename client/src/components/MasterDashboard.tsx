import { useState, useEffect } from 'react'
import { DriverDashboardData, VelocityLog } from '../../../shared/types'

interface MasterDashboardProps {
    driverId: string
    onSelectTrip: (tripId: string) => void
    onLayoutUpdate: () => void
    refreshKey: number
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function MasterDashboard({ driverId, onSelectTrip, onLayoutUpdate, refreshKey }: MasterDashboardProps) {
    const [data, setData] = useState<DriverDashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = () => {
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
        }

        setLoading(true)
        fetchData()
        const interval = setInterval(fetchData, 3000) // Poll every 3 seconds

        return () => clearInterval(interval)
    }, [driverId, onLayoutUpdate, refreshKey])

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
    const forecastStatus = latestLog?.forecast_status || goal.goal_completion_forecast || 'on_track'

    let statusClass = 'on-track'
    if (forecastStatus === 'ahead' || forecastStatus === 'achieved') statusClass = 'ahead'
    else if (forecastStatus === 'at_risk') statusClass = 'at-risk'
    else if (forecastStatus === 'warming_up') statusClass = 'warming-up'

    // Gauge calculations
    const radius = 100
    const circumference = Math.PI * radius
    const strokeDashoffset = Math.max(0, circumference - (goalPercent / 100) * circumference)
    const avgStress = recentTrips.length > 0
        ? recentTrips.reduce((acc, t) => acc + (t.stress_score || 0), 0) / recentTrips.length
        : 0

    return (
        <div className="dashboard-grid">

            {/* Top row: Velocity Overview */}
            <div className={`card velocity-card ${statusClass}`}>
                <div className="card-title">Earnings Velocity</div>
                <div className="velocity-main">
                    <div className="velocity-metric">
                        <span className="v-label">Current Velocity</span>
                        <span className="v-value">₹{latestLog?.current_velocity.toFixed(2) || goal.earnings_velocity.toFixed(2)}/hr</span>
                    </div>
                    <div className="velocity-divider"></div>
                    <div className="velocity-metric">
                        <span className="v-label">Target Velocity</span>
                        <span className="v-value">₹{latestLog?.target_velocity.toFixed(2) || (goal.target_earnings / goal.target_hours).toFixed(2)}/hr</span>
                    </div>
                </div>

                <div className="gauge-container">
                    <svg className="speedometer" viewBox="0 0 250 150">
                        <defs>
                            <linearGradient id="grad-ahead" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="100%" stopColor="#047857" />
                            </linearGradient>
                            <linearGradient id="grad-on-track" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#fbbf24" />
                                <stop offset="100%" stopColor="#d97706" />
                            </linearGradient>
                            <linearGradient id="grad-warming-up" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#60a5fa" />
                                <stop offset="100%" stopColor="#2563eb" />
                            </linearGradient>
                            <linearGradient id="grad-at-risk" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f87171" />
                                <stop offset="100%" stopColor="#dc2626" />
                            </linearGradient>
                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="6" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>

                        {/* Background Arc */}
                        <path
                            d={`M 25 125 A ${radius} ${radius} 0 0 1 225 125`}
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="18"
                            strokeLinecap="round"
                        />
                        {/* Foreground Progress Arc */}
                        <path
                            className={`gauge-fill ${statusClass}`}
                            d={`M 25 125 A ${radius} ${radius} 0 0 1 225 125`}
                            fill="none"
                            stroke={`url(#grad-${statusClass})`}
                            strokeWidth="18"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{
                                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
                                filter: 'url(#glow)'
                            }}
                        />
                        <text x="125" y="75" textAnchor="middle" className="gauge-lbl">
                            Goal Progress
                        </text>
                        <text x="125" y="118" textAnchor="middle" className="gauge-percent">
                            {goalPercent}%
                        </text>
                    </svg>

                    <div className="gauge-stats">
                        <div className="gauge-stat">
                            <span>₹{goal.current_earnings}</span>
                            <small>Earned</small>
                        </div>
                        <div className="gauge-divider"></div>
                        <div className="gauge-stat">
                            <span>₹{goal.target_earnings}</span>
                            <small>Target</small>
                        </div>
                        <div className="gauge-divider"></div>
                        <div className="gauge-stat">
                            <span style={{ color: avgStress > 0.6 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                                {avgStress.toFixed(2)}
                            </span>
                            <small>Avg Stress</small>
                        </div>
                    </div>
                </div>

                <div className="forecast-text" style={{ textAlign: 'center', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                    <span className="forecast-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginRight: '8px' }}>
                        Forecast Status:
                    </span>
                    <span className={`rating-badge ${statusClass}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                        {forecastStatus.replace('_', ' ').toUpperCase()}
                    </span>
                </div>
            </div>

            {/* Bottom Row / Sidebar: Trips History */}
            <div className="card trips-card">
                <div className="card-title">Today's Trips</div>
                <p className="subtitle">Select a trip to view safety analytics.</p>
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
                                <div className="trip-details" style={{ flex: 2 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="trip-id">{trip.trip_id}</span>
                                        <span className={`rating-badge ${trip.trip_rating?.toLowerCase()}`}>
                                            {trip.trip_rating}
                                        </span>
                                    </div>
                                    <span className="trip-loc">{trip.pickup_location} → {trip.dropoff_location}</span>
                                </div>
                                <div className="trip-stress">
                                    <div className="stress-label-row">
                                        <span className="stress-lbl">Stress</span>
                                        <span className="stress-val">{Math.round((trip.stress_score ?? 0) * 100)}%</span>
                                    </div>
                                    <div className="stress-bar-bg">
                                        <div
                                            className={`stress-bar-fill ${trip.trip_rating?.toLowerCase()}`}
                                            style={{ width: `${Math.min(100, (trip.stress_score ?? 0) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="trip-fare">₹{trip.fare}</div>
                                <div className="trip-action">▸</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    )
}
