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
    const [trips, setTrips] = useState<any[]>([])
    const [selectedTrip, setSelectedTrip] = useState<string | null>(null)
    const [showPicker, setShowPicker] = useState(false)
    const [completedTrips, setCompletedTrips] = useState<string[]>([])
    const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)
    const [tripCompleteMessage, setTripCompleteMessage] = useState<string | null>(null)
    const [showSummaryOverlay, setShowSummaryOverlay] = useState(false)
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
        fetch(`${API_BASE}/demo/trips`)
            .then((r) => r.json())
            .then((data: any[]) => {
                setTrips(data)
                // Also update local completedTrips for consistency
                const completed = data.filter(t => t.status === 'completed').map(t => t.trip_id)
                setCompletedTrips(completed)
            })
            .catch(console.error)
    }, [dashboardRefreshKey])

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
        if (isStreaming) return
        const trip = trips.find(t => t.trip_id === tripId)
        setSelectedTrip(tripId)
        resetAll()

        if (trip?.status === 'completed') {
            setShowSummaryOverlay(true)
            completedRef.current = true
            setMotionStatus('done')
        } else {
            setShowSummaryOverlay(false)
            completedRef.current = false
        }
        setView('TRIP_ANALYSIS')
    }

    const handleBackToDashboard = () => {
        resetAll()
        setSelectedTrip(null)
        setShowSummaryOverlay(false)
        setView('MASTER_DASHBOARD')
    }

    const isStreaming = motionStatus === 'streaming' || audioStreamActive.isStreaming || fusionStream.isStreaming
    const allDone = motionStatus === 'done' && audioStreamActive.isDone && fusionStream.isDone

    // Trip completion: show overlay when all streams finish
    useEffect(() => {
        if (allDone && selectedTrip && !completedRef.current) {
            completedRef.current = true
            fetch(`${API_BASE}/demo/${selectedTrip}/complete`, { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    console.log('Γ£à Trip completed and saved to DB:', data)
                    setCompletedTrips(prev => prev.includes(selectedTrip) ? prev : [...prev, selectedTrip])
                    setDashboardRefreshKey(k => k + 1)
                    setShowSummaryOverlay(true)
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
                    <div className="header-logo"><img src="/uber.png" alt="Uber" /></div>
                    <div>
                        <div className="header-title">Driver Pulse</div>
                        <div className="header-subtitle">Welcome, {driverId}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', marginLeft: 'auto' }}>
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
                <div className="header-logo" onClick={handleBackToDashboard} style={{ cursor: 'pointer' }}>
                    <img src="/uber.png" alt="Uber" />
                </div>
                <div>
                    <div className="header-title">{selectedTrip}</div>
                    <div className="header-subtitle">Safety &amp; Pacing</div>
                </div>
                <button
                    className="btn-secondary"
                    onClick={handleBackToDashboard}
                    style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                >
                    ΓåÉ Back to Dashboard
                </button>
            </header>

            {/* Trip completion toast */}
            {tripCompleteMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--uber-dark)',
                    color: '#ffffff',
                    padding: '0.75rem 1.375rem',
                    borderRadius: '10px',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    boxShadow: '0 8px 32px rgba(9,9,26,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    zIndex: 9999,
                    animation: 'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.01em',
                }}>
                    <span style={{ color: 'var(--uber-cyan)', fontSize: '1rem' }}>Γ£ô</span>
                    {tripCompleteMessage}
                </div>
            )}

            <div className="layout">
                {/* Sidebar */}
                <aside className="sidebar">
                    <div className="card">
                        <div className="card-title">Select Trip</div>
                        {trips.map((trip) => {
                            const isDone = trip.status === 'completed' || completedTrips.includes(trip.trip_id)
                            return (
                                <button
                                    key={trip.trip_id}
                                    className={`trip-btn ${selectedTrip === trip.trip_id ? 'active' : ''} ${isDone ? 'done' : ''}`}
                                    onClick={() => handleSelectTrip(trip.trip_id)}
                                >
                                    <span>≡ƒôì</span>
                                    {trip.trip_id}
                                    {isDone && <span className="trip-done-badge">Γ£ô</span>}
                                </button>
                            )
                        })}
                    </div>

                    <div className="card">
                        <div className="card-title">Flagged Moments</div>
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
                                    <div className="stat-label">ΓÜí Conflicts</div>
                                </div>
                            )}
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-orange)' }}>
                                    {fusionStream.flags.filter(f => f.flag_type === 'motion_only').length}
                                </div>
                                <div className="stat-label">≡ƒÜù Motion</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>
                                    {fusionStream.flags.filter(f => f.flag_type === 'audio_only').length}
                                </div>
                                <div className="stat-label">≡ƒöè Audio</div>
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
                                    <div className="stat-label">ΓÜá Collision</div>
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
                                <div className="legend-dot" style={{ background: '#dc2626' }} /> ΓÜí Conflict
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: '#ea580c' }} /> ≡ƒÜù Motion only
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot" style={{ background: '#2563eb' }} /> ≡ƒöè Audio only
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
                                {isStreaming ? 'ΓÅ│ StreamingΓÇª' : 'Γû╢ Process Simulation'}
                            </button>
                            {(isStreaming || motionStatus !== 'idle') && (
                                <button className="btn-secondary" onClick={resetAll}>Γå║ Reset</button>
                            )}
                            <span className={`status-dot ${isStreaming ? 'streaming' : allDone ? 'done' : ''}`}>
                                {isStreaming ? 'Live streamingΓÇª' : allDone ? 'Analysis complete' : 'Ready'}
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

            {/* Trip Summary Overlay */}
            {showSummaryOverlay && (
                <div className="summary-overlay">
                    <div className="summary-overlay-card">
                        <div className="summary-overlay-header">
                            <div className="summary-success-icon">Γ£ô</div>
                            <div>
                                <h2>Trip Completed</h2>
                                <p>Safety analysis and pacing summary for {selectedTrip}</p>
                            </div>
                        </div>

                        <div className="summary-snippet">
                            <div className="summary-snippet-item">
                                <span className="label">Flags</span>
                                <span className="value">{flagCount}</span>
                            </div>
                            <div className="summary-snippet-item">
                                <span className="label">Conflicts</span>
                                <span className="value" style={{ color: 'var(--accent-red)' }}>
                                    {fusionStream.flags.filter(f => f.flag_type === 'conflict_moment').length}
                                </span>
                            </div>
                            <div className="summary-snippet-item">
                                <span className="label">Spikes</span>
                                <span className="value">{aStats.total}</span>
                            </div>
                        </div>

                        <button className="btn-primary summary-back-btn" onClick={handleBackToDashboard}>
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

