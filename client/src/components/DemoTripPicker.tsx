import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'

interface DemoTripMeta {
    trip_id: string
    label: string
    description: string
    start_time: string
    date: string
    duration_min: number
    fare: number
    distance_km: number
    status: 'available' | 'ongoing' | 'completed'
}

interface Props {
    onSelect: (tripId: string) => void
    onClose: () => void
    usedTrips: string[]
}

export default function DemoTripPicker({ onSelect, onClose, usedTrips }: Props) {
    const [trips, setTrips] = useState<DemoTripMeta[]>([])
    const [loading, setLoading] = useState(false)
    const [starting, setStarting] = useState<string | null>(null)

    useEffect(() => {
        fetch(`${API_BASE}/demo/trips`)
            .then(r => r.json())
            .then(setTrips)
            .catch(console.error)
    }, [])

    const handleSelect = async (trip: DemoTripMeta) => {
        setStarting(trip.trip_id)
        setLoading(true)
        try {
            await fetch(`${API_BASE}/demo/${trip.trip_id}/start`, { method: 'POST' })
            onSelect(trip.trip_id)
        } catch (err) {
            console.error('Failed to start trip:', err)
        } finally {
            setLoading(false)
            setStarting(null)
        }
    }

    return (
        <div className="demo-picker-overlay" onClick={onClose}>
            <div className="demo-picker-modal" onClick={e => e.stopPropagation()}>
                <div className="demo-picker-header">
                    <div>
                        <div className="demo-picker-title">Select Trip</div>
                        <div className="demo-picker-subtitle">Select a route to begin</div>
                    </div>
                    <button className="demo-picker-close" onClick={onClose}>✕</button>
                </div>

                <div className="demo-picker-list">
                    {trips.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Loading trips…
                        </div>
                    ) : trips.map(trip => {
                        const used = trip.status === 'completed'
                        return (
                            <div
                                key={trip.trip_id}
                                className={`demo-trip-card ${used ? 'used' : ''}`}
                            >
                                <div className="demo-trip-card-top">
                                    <div>
                                        <div className="demo-trip-id">{trip.trip_id}</div>
                                        <div className="demo-trip-label">{trip.label}</div>
                                    </div>
                                    <div className="demo-trip-meta">
                                        <span>⏱ {trip.duration_min} min</span>
                                        <span>📍 {trip.distance_km} km</span>
                                        <span>₹{trip.fare.toFixed(0)}</span>
                                    </div>
                                </div>
                                <div className="demo-trip-desc">{trip.description}</div>
                                <div className="demo-trip-start-row">
                                    <span className="demo-trip-time">🕐 Starts {trip.start_time}</span>
                                    <button
                                        className="btn-primary demo-trip-btn"
                                        disabled={loading || used}
                                        onClick={() => handleSelect(trip)}
                                    >
                                        {starting === trip.trip_id
                                            ? '⏳ Starting…'
                                            : used
                                                ? '✓ Completed'
                                                : '▶ Start Trip'}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
