import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'

interface PastTrip {
    trip_id: string
    driver_id: string
    date: string
    start_time: string
    end_time: string
    duration_min: number
    distance_km: number
    fare: number
    surge_multiplier: number
    pickup_location: string
    dropoff_location: string
    trip_status: string
    flag_count: number
    stress_score: number | null
    trip_rating: string | null
}

interface Props {
    driverId: string
    onBack: () => void
}

function statusColor(status: string) {
    if (status === 'completed') return 'var(--accent-green)'
    if (status === 'ongoing') return 'var(--accent-yellow)'
    return 'var(--text-muted)'
}

function ratingColor(rating: string | null) {
    if (!rating) return 'var(--text-muted)'
    if (rating === 'excellent') return 'var(--accent-green)'
    if (rating === 'good') return '#60a5fa'
    if (rating === 'fair') return 'var(--accent-yellow)'
    return 'var(--accent-red)'
}

function stressBar(score: number) {
    const pct = Math.min(100, score * 100)
    const color = score < 0.3 ? 'var(--accent-green)'
        : score < 0.55 ? 'var(--accent-yellow)'
            : score < 0.75 ? 'var(--accent-orange)'
                : 'var(--accent-red)'
    return { pct, color }
}

export default function PastTrips({ driverId, onBack }: Props) {
    const [trips, setTrips] = useState<PastTrip[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setLoading(true)
        fetch(`${API_BASE}/past-trips/${driverId}`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load past trips')
                return r.json()
            })
            .then((data: PastTrip[]) => {
                setTrips(data)
                setLoading(false)
            })
            .catch(err => {
                setError(err.message)
                setLoading(false)
            })
    }, [driverId])

    const totalFlags = trips.reduce((s, t) => s + (t.flag_count ?? 0), 0)

    return (
        <div>
            <header className="header">
                <div className="header-logo"><img src="/uber.png" alt="Uber" /></div>
                <div>
                    <div className="header-title">Past Trips</div>
                    <div className="header-subtitle">History for {driverId}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <button className="btn-secondary" onClick={onBack}>← Dashboard</button>
                </div>
            </header>

            <main className="main-content" style={{ padding: '2rem' }}>
                {loading && <div className="loading-state">Loading past trips…</div>}
                {error && <div className="error-state">{error}</div>}

                {!loading && !error && trips.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
                        No past trips found for {driverId}
                    </div>
                )}

                {!loading && !error && trips.length > 0 && (
                    <>
                        {/* Summary bar */}
                        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.75rem' }}>
                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <SumStat label="Total Trips" value={String(trips.length)} color="var(--text-primary)" />
                                <div className="gauge-divider" />
                                <SumStat label="Total Earnings" value={`₹${trips.reduce((s, t) => s + t.fare, 0).toFixed(0)}`} color="var(--accent-green)" />
                                <div className="gauge-divider" />
                                <SumStat label="Distance" value={`${trips.reduce((s, t) => s + t.distance_km, 0).toFixed(1)} km`} color="var(--uber-cyan)" />
                                <div className="gauge-divider" />
                                <SumStat label="Drive Time" value={`${trips.reduce((s, t) => s + t.duration_min, 0)} min`} color="var(--accent-yellow)" />
                                <div className="gauge-divider" />
                                <SumStat label="Total Flags" value={String(totalFlags)} color={totalFlags > 0 ? 'var(--accent-orange)' : 'var(--accent-green)'} />
                            </div>
                        </div>

                        {/* Trip card grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                            gap: '1rem',
                        }}>
                            {trips.map(trip => {
                                const sb = trip.stress_score != null ? stressBar(trip.stress_score) : null
                                return (
                                    <div key={trip.trip_id} className="card" style={{ padding: '1.2rem 1.2rem 1.2rem 1.6rem', position: 'relative', overflow: 'hidden' }}>
                                        {/* Side accent */}
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0,
                                            width: '4px', height: '100%',
                                            background: ratingColor(trip.trip_rating),
                                            borderRadius: '4px 0 0 4px',
                                        }} />

                                        {/* Header row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{trip.trip_id}</span>
                                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                {trip.trip_rating && (
                                                    <span style={{
                                                        fontSize: '0.65rem', fontWeight: 700,
                                                        color: ratingColor(trip.trip_rating),
                                                        border: `1px solid ${ratingColor(trip.trip_rating)}50`,
                                                        borderRadius: '999px', padding: '2px 8px',
                                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                                    }}>{trip.trip_rating}</span>
                                                )}
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: 600,
                                                    color: statusColor(trip.trip_status),
                                                    border: `1px solid ${statusColor(trip.trip_status)}40`,
                                                    borderRadius: '999px', padding: '2px 8px',
                                                    textTransform: 'uppercase',
                                                }}>{trip.trip_status === 'completed' ? '✓ Done' : trip.trip_status}</span>
                                            </div>
                                        </div>

                                        {/* Route */}
                                        <div style={{ fontSize: '0.82rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                                            <strong style={{ color: 'var(--text-primary)' }}>{trip.pickup_location}</strong>
                                            <span style={{ color: 'var(--uber-cyan)', margin: '0 0.35rem' }}>→</span>
                                            <strong style={{ color: 'var(--text-primary)' }}>{trip.dropoff_location}</strong>
                                        </div>

                                        {/* Stats row */}
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                            <MiniStat label="Fare" value={`₹${trip.fare.toFixed(0)}`} color="var(--accent-green)" />
                                            <MiniStat label="Distance" value={`${trip.distance_km.toFixed(1)} km`} />
                                            <MiniStat label="Duration" value={`${trip.duration_min} min`} />
                                            {trip.surge_multiplier > 1 && (
                                                <MiniStat label="Surge" value={`${trip.surge_multiplier}×`} color="var(--accent-yellow)" />
                                            )}
                                            <MiniStat
                                                label="🚩 Flags"
                                                value={trip.flag_count > 0 ? String(trip.flag_count) : '0'}
                                                color={trip.flag_count > 0 ? 'var(--accent-orange)' : 'var(--accent-green)'}
                                            />
                                        </div>

                                        {/* Stress bar — only shown if we have data */}
                                        {sb && (
                                            <div style={{ marginBottom: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                                                    <span>Stress</span>
                                                    <span style={{ color: sb.color, fontWeight: 600 }}>{Math.round(sb.pct)}%</span>
                                                </div>
                                                <div className="stress-bar-bg">
                                                    <div className="stress-bar-fill" style={{ width: `${sb.pct}%`, background: sb.color }} />
                                                </div>
                                            </div>
                                        )}

                                        {/* Date/time */}
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            📅 {trip.date} &nbsp; 🕐 {trip.start_time.slice(0, 5)}–{trip.end_time.slice(0, 5)}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}

function SumStat({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
        </div>
    )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
        </div>
    )
}
