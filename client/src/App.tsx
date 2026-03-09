import { useState, useCallback, useEffect, useRef } from 'react'
import { MotionEvent, MotionClass, AudioEvent } from '../../shared/types'
import { useAudioStream } from './hooks/useAudioStream'
import { useFusionStream } from './hooks/useFlags'
import UnifiedTimeline from './components/UnifiedTimeline'
import MasterDashboard from './components/MasterDashboard'
import Login from './components/Login'
import DemoTripPicker from './components/DemoTripPicker'

const API_BASE = 'http://localhost:3001/api'

interface MotionStats {
    total: number
    normal: number
    moderate: number
    harsh: number
    collision: number
}

function calcMotionStats(events: MotionEvent[]): MotionStats {
    return {
        total: events.length,
        normal: events.filter((e) => e.event_type === MotionClass.normal).length,
        moderate: events.filter((e) => e.event_type === MotionClass.moderate).length,
        harsh: events.filter((e) => e.event_type === MotionClass.harsh).length,
        collision: events.filter((e) => e.event_type === MotionClass.collision).length,
    }
}

function calcAudioStats(events: AudioEvent[]) {
    return {
        total: events.length,
        sustained: events.filter((e) => e.is_sustained).length,
        critical: events.filter(
            (e) => e.severity === 'CRITICAL_SPIKE' || e.severity === 'SHORT_CRITICAL'
        ).length,
    }
}

type ViewState = 'LOGIN' | 'MASTER_DASHBOARD' | 'TRIP_ANALYSIS'
type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'

export default function App() {
    const [view, setView] = useState<ViewState>('LOGIN')
    const [driverId, setDriverId] = useState<string>('')
    const [trips, setTrips] = useState<string[]>([])
    const [selectedTrip, setSelectedTrip] = useState<string | null>(null)
    const [showPicker, setShowPicker] = useState(false)
    const [completedTrips, setCompletedTrips] = useState<string[]>([])
    const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)
    const completedRef = useRef<boolean>(false)

    // Motion stream state (Phase 1)
    const [motionEvents, setMotionEvents] = useState<MotionEvent[]>([])
    const [motionStatus, setMotionStatus] = useState<StreamStatus>('idle')
    const [motionEsRef, setMotionEsRef] = useState<EventSource | null>(null)

    // Audio stream (Phase 2)
    const [audioTripTrigger, setAudioTripTrigger] = useState<string | null>(null)
    const audioStreamActive = useAudioStream(audioTripTrigger)

    // Fusion stream (Phase 3)
    const [fusionTripTrigger, setFusionTripTrigger] = useState<string | null>(null)
    const fusionStream = useFusionStream(fusionTripTrigger)

    useEffect(() => {
        fetch(`${API_BASE}/trips`)
            .then((r) => r.json())
            .then((data: string[]) => {
                setTrips(data)
            })
            .catch(console.error)
    }, [])

    const stopMotion = useCallback(() => {
        if (motionEsRef) {
            motionEsRef.close()
            setMotionEsRef(null)
        }
    }, [motionEsRef])

    const startStreams = useCallback(() => {
        if (!selectedTrip) return
        stopMotion()
        setMotionEvents([])
        setMotionStatus('streaming')
        setAudioTripTrigger(null)
        setFusionTripTrigger(null)
        completedRef.current = false

        // Use demo stream for per-trip CSV files
        const es = new EventSource(`${API_BASE}/motion/${selectedTrip}/stream`)
        setMotionEsRef(es)

        es.onmessage = (e) => {
            if (e.data === 'DONE') {
                setMotionStatus('done')
                es.close()
                setMotionEsRef(null)
                return
            }
            if (e.data === 'ERROR') { setMotionStatus('error'); es.close(); return }
            try {
                const event: MotionEvent = JSON.parse(e.data)
                setMotionEvents((prev) => [event, ...prev])
            } catch { /* ignore */ }
        }
        es.onerror = () => { setMotionStatus('error'); es.close() }

        setTimeout(() => {
            setAudioTripTrigger(selectedTrip)
            setFusionTripTrigger(selectedTrip)
        }, 150)
    }, [selectedTrip, stopMotion])

    const resetAll = useCallback(() => {
        stopMotion()
        setMotionEvents([])
        setMotionStatus('idle')
        setAudioTripTrigger(null)
        setFusionTripTrigger(null)
        audioStreamActive.reset()
        fusionStream.reset()
    }, [stopMotion, audioStreamActive, fusionStream])

    const handleLogin = (id: string) => {
        setDriverId(id)
        setView('MASTER_DASHBOARD')
    }

    const handleSelectTrip = (tripId: string) => {
        setSelectedTrip(tripId)
        resetAll()
        setView('TRIP_ANALYSIS')
    }

    const handleBackToDashboard = () => {
        resetAll()
        setSelectedTrip(null)
        setView('MASTER_DASHBOARD')
    }

    const isStreaming = motionStatus === 'streaming' || audioStreamActive.isStreaming || fusionStream.isStreaming
    const allDone = motionStatus === 'done' && audioStreamActive.isDone && fusionStream.isDone

    // Auto-complete: call /api/demo/:tripId/complete once when all streams finish
    useEffect(() => {
        if (allDone && selectedTrip && !completedRef.current) {
            completedRef.current = true
            fetch(`${API_BASE}/demo/${selectedTrip}/complete`, { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    console.log('✅ Trip completed and saved to DB:', data)
                    setCompletedTrips(prev => prev.includes(selectedTrip) ? prev : [...prev, selectedTrip])
                    // Force dashboard re-fetch so today's trips + velocity update
                    setDashboardRefreshKey(k => k + 1)
                })
                .catch(err => console.error('Failed to complete trip:', err))
        }
    }, [allDone, selectedTrip])

    // RENDER LOGIN
    if (view === 'LOGIN') {
        return <Login onLogin={handleLogin} />
    }

    // RENDER MASTER DASHBOARD
    if (view === 'MASTER_DASHBOARD') {
        return (
            <div>
                <header className="header">
                    <div className="header-logo">🚗</div>
                    <div>
                        <div className="header-title">Driver Pulse Dashboard</div>
                        <div className="header-subtitle">Welcome, {driverId}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button className="btn-primary" onClick={() => setShowPicker(true)}>+ New Trip</button>
                        <button className="btn-secondary" onClick={() => setView('LOGIN')}>Sign Out</button>
                    </div>
                </header>

                <main className="main-content" style={{ padding: '2rem' }}>
                    <MasterDashboard
                        driverId={driverId}
                        onSelectTrip={handleSelectTrip}
                        onLayoutUpdate={() => { }}
                        refreshKey={dashboardRefreshKey}
                    />
                </main>

                {showPicker && (
                    <DemoTripPicker
                        usedTrips={completedTrips}
                        onSelect={(tripId) => {
                            setShowPicker(false)
                            handleSelectTrip(tripId)
                        }}
                        onClose={() => setShowPicker(false)}
                    />
                )}
            </div>
        )
    }

    // RENDER TRIP ANALYSIS (Legacy App.tsx View)
    const stats = calcMotionStats(motionEvents)
    const aStats = calcAudioStats(audioStreamActive.events)
    const flagCount = fusionStream.flags.length

    return (
        <div>
            <header className="header">
                <div className="header-logo" onClick={handleBackToDashboard} style={{ cursor: 'pointer' }}>←</div>
                <div>
                    <div className="header-title">Trip Analysis: {selectedTrip}</div>
                    <div className="header-subtitle">Edge/Cloud Fusion Telemetry</div>
                </div>
            </header>

            <div className="layout">
                {/* Sidebar */}
                <aside className="sidebar">
                    <div className="card">
                        <div className="card-title">Select Trip</div>
                        {trips.map((trip) => (
                            <button
                                key={trip}
                                className={`trip-btn ${selectedTrip === trip ? 'active' : ''}`}
                                onClick={() => handleSelectTrip(trip)}
                            >
                                <span>📍</span>{trip}
                            </button>
                        ))}
                    </div>

                    {/* Fusion flags summary */}
                    <div className="card">
                        <div className="card-title">⚡ Flags</div>
                        <div className="stats-grid">
                            <div className="stat-item" style={{ gridColumn: '1 / -1' }}>
                                <div className="stat-value" style={{ color: flagCount > 0 ? 'var(--accent-yellow)' : 'inherit' }}>
                                    {flagCount}
                                </div>
                                <div className="stat-label">Total Flags</div>
                            </div>
                            {fusionStream.flags.filter(f => f.flag_type === 'conflict_moment').length > 0 && (
                                <div className="stat-item" style={{ gridColumn: '1 / -1' }}>
                                    <div className="stat-value" style={{ color: 'var(--accent-red)' }}>
                                        {fusionStream.flags.filter(f => f.flag_type === 'conflict_moment').length}
                                    </div>
                                    <div className="stat-label">⚡ Conflicts</div>
                                </div>
                            )}
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-orange)' }}>
                                    {fusionStream.flags.filter(f => f.flag_type === 'motion_only').length}
                                </div>
                                <div className="stat-label">🚗 Motion</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>
                                    {fusionStream.flags.filter(f => f.flag_type === 'audio_only').length}
                                </div>
                                <div className="stat-label">🔊 Audio</div>
                            </div>
                        </div>
                    </div>

                    {/* Motion stats */}
                    <div className="card">
                        <div className="card-title">Motion</div>
                        <div className="stats-grid">
                            <div className="stat-item">
                                <div className="stat-value">{stats.total}</div>
                                <div className="stat-label">Windows</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{stats.normal}</div>
                                <div className="stat-label">Normal</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-yellow)' }}>{stats.moderate}</div>
                                <div className="stat-label">Moderate</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-orange)' }}>{stats.harsh}</div>
                                <div className="stat-label">Harsh</div>
                            </div>
                            {stats.collision > 0 && (
                                <div className="stat-item" style={{ gridColumn: '1 / -1' }}>
                                    <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{stats.collision}</div>
                                    <div className="stat-label">⚠ Collision</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Audio stats */}
                    <div className="card">
                        <div className="card-title">Audio</div>
                        <div className="stats-grid">
                            <div className="stat-item">
                                <div className="stat-value">{aStats.total}</div>
                                <div className="stat-label">Spikes</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{aStats.sustained}</div>
                                <div className="stat-label">Sustained</div>
                            </div>
                            <div className="stat-item" style={{ gridColumn: '1 / -1' }}>
                                <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{aStats.critical}</div>
                                <div className="stat-label">Critical</div>
                            </div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="card">
                        <div className="card-title">Legend</div>
                        <div className="legend" style={{ flexDirection: 'column' }}>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: '#dc2626' }} /> ⚡ Conflict
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: '#ea580c' }} /> 🚗 Motion only
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: '#2563eb' }} /> 🔊 Audio only
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: '#f97316' }} /> Motion event
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: 'var(--accent-blue)' }} /> Audio spike
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main */}
                <main className="main-content">
                    <div className="card">
                        <div className="controls">
                            <button
                                id="btn-start-stream"
                                className="btn-primary"
                                onClick={startStreams}
                                disabled={!selectedTrip || isStreaming}
                            >
                                {isStreaming ? '⏳ Streaming…' : '▶ Process Simulation'}
                            </button>
                            {(isStreaming || motionStatus !== 'idle') && (
                                <button className="btn-secondary" onClick={resetAll}>↺ Reset</button>
                            )}
                            <span className={`status-dot ${isStreaming ? 'streaming' : allDone ? 'done' : ''}`}>
                                {isStreaming ? 'Live streaming…' : allDone ? 'Analysis complete' : 'Ready'}
                            </span>
                        </div>
                    </div>

                    <UnifiedTimeline
                        motionEvents={motionEvents}
                        audioEvents={audioStreamActive.events}
                        flags={fusionStream.flags}
                        isMotionStreaming={motionStatus === 'streaming'}
                        isAudioStreaming={audioStreamActive.isStreaming}
                        isMotionDone={motionStatus === 'done'}
                        isAudioDone={audioStreamActive.isDone}
                        isFusionStreaming={fusionStream.isStreaming}
                        isFusionDone={fusionStream.isDone}
                        summary={fusionStream.summary}
                    />
                </main>
            </div>
        </div>
    )
}

