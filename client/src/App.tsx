import { useState, useEffect, useRef, useCallback } from 'react'
import { MotionEvent, MotionClass } from '../../shared/types'

const API_BASE = 'http://localhost:3001/api'

const EVENT_ICONS: Record<MotionClass, string> = {
    [MotionClass.normal]: '✓',
    [MotionClass.moderate]: '〜',
    [MotionClass.harsh]: '⚡',
    [MotionClass.collision]: '💥',
}

const EVENT_LABELS: Record<MotionClass, string> = {
    [MotionClass.normal]: 'Normal',
    [MotionClass.moderate]: 'Moderate',
    [MotionClass.harsh]: 'Harsh',
    [MotionClass.collision]: 'Collision',
}

type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'

interface Stats {
    total: number
    normal: number
    moderate: number
    harsh: number
    collision: number
}

function calcStats(events: MotionEvent[]): Stats {
    return {
        total: events.length,
        normal: events.filter((e) => e.event_type === MotionClass.normal).length,
        moderate: events.filter((e) => e.event_type === MotionClass.moderate).length,
        harsh: events.filter((e) => e.event_type === MotionClass.harsh).length,
        collision: events.filter((e) => e.event_type === MotionClass.collision).length,
    }
}

function formatElapsed(s: number): string {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
}

export default function App() {
    const [trips, setTrips] = useState<string[]>([])
    const [selectedTrip, setSelectedTrip] = useState<string | null>(null)
    const [events, setEvents] = useState<MotionEvent[]>([])
    const [status, setStatus] = useState<StreamStatus>('idle')
    const eventSourceRef = useRef<EventSource | null>(null)
    const listRef = useRef<HTMLDivElement>(null)

    // Fetch available trips
    useEffect(() => {
        fetch(`${API_BASE}/trips`)
            .then((r) => r.json())
            .then((data: string[]) => {
                setTrips(data)
                if (data.length > 0) setSelectedTrip(data[0])
            })
            .catch(() => console.error('Failed to fetch trips'))
    }, [])

    // Auto-scroll events list
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = 0
        }
    }, [events.length])

    const stopStream = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
    }, [])

    const startStream = useCallback(() => {
        if (!selectedTrip) return
        stopStream()
        setEvents([])
        setStatus('streaming')

        const es = new EventSource(`${API_BASE}/motion/${selectedTrip}/stream`)
        eventSourceRef.current = es

        es.onmessage = (e) => {
            if (e.data === 'DONE') {
                setStatus('done')
                es.close()
                eventSourceRef.current = null
                return
            }
            if (e.data === 'ERROR') {
                setStatus('error')
                es.close()
                return
            }
            try {
                const event: MotionEvent = JSON.parse(e.data)
                setEvents((prev) => [event, ...prev])
            } catch {
                // ignore parse errors
            }
        }

        es.onerror = () => {
            setStatus('error')
            es.close()
        }
    }, [selectedTrip, stopStream])

    useEffect(() => {
        return () => stopStream()
    }, [stopStream])

    const stats = calcStats(events)

    const statusLabel: Record<StreamStatus, string> = {
        idle: 'Ready',
        streaming: 'Live streaming…',
        done: 'Stream complete',
        error: 'Connection error',
    }

    return (
        <div>
            {/* Header */}
            <header className="header">
                <div className="header-logo">🚗</div>
                <div>
                    <div className="header-title">Driver Pulse</div>
                    <div className="header-subtitle">Motion Safety Analysis</div>
                </div>
                <span className="header-badge">Phase 1 — Motion</span>
            </header>

            <div className="layout">
                {/* Sidebar */}
                <aside className="sidebar">
                    {/* Trip selector */}
                    <div className="card">
                        <div className="card-title">Select Trip</div>
                        {trips.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading trips…</p>
                        ) : (
                            trips.map((trip) => (
                                <button
                                    key={trip}
                                    className={`trip-btn ${selectedTrip === trip ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedTrip(trip)
                                        setEvents([])
                                        setStatus('idle')
                                        stopStream()
                                    }}
                                >
                                    <span>📍</span>
                                    {trip}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Stats */}
                    <div className="card">
                        <div className="card-title">Session Stats</div>
                        <div className="stats-grid">
                            <div className="stat-item">
                                <div className="stat-value">{stats.total}</div>
                                <div className="stat-label">Windows</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
                                    {stats.normal}
                                </div>
                                <div className="stat-label">Normal</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-yellow)' }}>
                                    {stats.moderate}
                                </div>
                                <div className="stat-label">Moderate</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-orange)' }}>
                                    {stats.harsh}
                                </div>
                                <div className="stat-label">Harsh</div>
                            </div>
                            {stats.collision > 0 && (
                                <div className="stat-item" style={{ gridColumn: '1 / -1' }}>
                                    <div className="stat-value" style={{ color: 'var(--accent-red)' }}>
                                        {stats.collision}
                                    </div>
                                    <div className="stat-label">⚠ Collision</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="card">
                        <div className="card-title">Event Types</div>
                        <div className="legend" style={{ flexDirection: 'column' }}>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: 'var(--accent-green)' }} />
                                Normal — Routine driving
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: 'var(--accent-yellow)' }} />
                                Moderate — Bumpy / mild event
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: 'var(--accent-orange)' }} />
                                Harsh — Hard brake / accel
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: 'var(--accent-red)' }} />
                                Collision — Severe impact
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main content */}
                <main className="main-content">
                    {/* Controls */}
                    <div className="card">
                        <div className="controls">
                            <button
                                className="btn-primary"
                                onClick={startStream}
                                disabled={!selectedTrip || status === 'streaming'}
                                id="btn-start-stream"
                            >
                                {status === 'streaming' ? '⏳ Streaming…' : '▶ Start Stream'}
                            </button>

                            {status === 'streaming' && (
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        stopStream()
                                        setStatus('idle')
                                    }}
                                >
                                    ■ Stop
                                </button>
                            )}

                            <span className={`status-dot ${status === 'streaming' ? 'streaming' : status === 'done' ? 'done' : ''}`}>
                                {statusLabel[status]}
                            </span>
                        </div>
                    </div>

                    {/* Events Feed */}
                    <div className="card">
                        <div className="events-header">
                            <div className="card-title" style={{ margin: 0 }}>
                                Motion Events
                            </div>
                            <span className="events-count">{events.length} events</span>
                        </div>

                        {events.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📡</div>
                                <div className="empty-state-text">
                                    {status === 'idle'
                                        ? `Select a trip and press Start Stream to begin.`
                                        : 'Waiting for events…'}
                                </div>
                            </div>
                        ) : (
                            <div className="events-list" ref={listRef}>
                                {events.map((event) => (
                                    <div key={event.event_id} className="event-card">
                                        <div className={`event-icon ${event.event_type}`}>
                                            {EVENT_ICONS[event.event_type]}
                                        </div>
                                        <div className="event-info">
                                            <span className={`event-type-badge ${event.event_type}`}>
                                                {EVENT_LABELS[event.event_type]}
                                            </span>
                                            <div className="event-explanation">{event.explanation}</div>
                                        </div>
                                        <div className="event-meta">
                                            <div className="event-score">{(event.score * 100).toFixed(0)}%</div>
                                            <div className="event-time">t={formatElapsed(event.elapsed_s)}</div>
                                            <div className="score-bar-container">
                                                <div
                                                    className={`score-bar ${event.event_type}`}
                                                    style={{ width: `${event.score * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
