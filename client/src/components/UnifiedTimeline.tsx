import { useState } from 'react'
import AudioEventCard from './AudioEventCard'
import FlagCard from './FlagCard'
import {
    AudioEvent,
    AudioSeverity,
    FlagEvent,
    MotionClass,
    MotionEvent,
} from '../../../shared/types'

interface FusionSummary {
    motion_count: number
    audio_count: number
    flag_count: number
    duration_ms: number
}

interface UnifiedTimelineProps {
    motionEvents: MotionEvent[]
    audioEvents: AudioEvent[]
    flags: FlagEvent[]
    isMotionStreaming: boolean
    isAudioStreaming: boolean
    isMotionDone: boolean
    isAudioDone: boolean
    isFusionStreaming: boolean
    isFusionDone: boolean
    summary: FusionSummary | null
}

const MOTION_ICONS: Record<MotionClass, string> = {
    [MotionClass.normal]: '✓',
    [MotionClass.moderate]: '〜',
    [MotionClass.harsh]: '⚡',
    [MotionClass.collision]: '💥',
}

const MOTION_LABELS: Record<MotionClass, string> = {
    [MotionClass.normal]: 'Normal',
    [MotionClass.moderate]: 'Moderate',
    [MotionClass.harsh]: 'Harsh',
    [MotionClass.collision]: 'Collision',
}

function formatElapsed(s: number): string {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
}

export default function UnifiedTimeline({
    motionEvents,
    audioEvents,
    flags,
    isMotionStreaming,
    isAudioStreaming,
    isMotionDone,
    isAudioDone,
    isFusionStreaming,
    isFusionDone,
    summary,
}: UnifiedTimelineProps) {
    const [sensorOpen, setSensorOpen] = useState(true)

    const filteredMotion = motionEvents.filter((e) => e.event_type !== MotionClass.normal)
    const filteredAudio = audioEvents.filter((e) => e.severity !== AudioSeverity.SHORT_LOW)

    const allDone = isMotionDone && isAudioDone && isFusionDone
    const anyStreaming = isMotionStreaming || isAudioStreaming || isFusionStreaming
    const nothingStarted = !anyStreaming && !allDone && flags.length === 0

    // Auto-collapse sensor section once fusion is done
    const sensorVisible = sensorOpen && !(isFusionDone && !sensorOpen)

    return (
        <div className="card">
            {/* ── Stream indicators ────────────────────────────────────── */}
            <div className="timeline-summary">
                <div className="summary-row">
                    <div className="summary-stream-indicator">
                        <span className={`status-dot ${isMotionStreaming ? 'streaming' : isMotionDone ? 'done' : ''}`} />
                        <span className="summary-label">Motion</span>
                    </div>
                    <div className="summary-stats">
                        <span className="summary-stat">{motionEvents.length} windows</span>
                        {filteredMotion.length > 0 && <span className="summary-stat harsh">{filteredMotion.length} notable</span>}
                    </div>
                </div>
                <div className="summary-row">
                    <div className="summary-stream-indicator">
                        <span className={`status-dot ${isAudioStreaming ? 'streaming' : isAudioDone ? 'done' : ''}`} />
                        <span className="summary-label">Audio</span>
                    </div>
                    <div className="summary-stats">
                        <span className="summary-stat">{audioEvents.length} spikes</span>
                        {filteredAudio.length > 0 && <span className="summary-stat sustained">{filteredAudio.length} notable</span>}
                    </div>
                </div>
                <div className="summary-row">
                    <div className="summary-stream-indicator">
                        <span className={`status-dot ${isFusionStreaming ? 'streaming' : isFusionDone ? 'done' : ''}`} />
                        <span className="summary-label">Fusion</span>
                    </div>
                    <div className="summary-stats">
                        <span className="summary-stat">{flags.length} flags</span>
                    </div>
                </div>
            </div>

            {/* ── Section 1: FLAGS ─────────────────────────────────────── */}
            <div className="events-header" style={{ marginTop: '1rem' }}>
                <div className="card-title" style={{ margin: 0 }}>⚡ Flagged Events</div>
                {flags.length > 0 && (
                    <span className="events-count">{flags.length} flag{flags.length !== 1 ? 's' : ''}</span>
                )}
            </div>

            {nothingStarted && (
                <div className="empty-state">
                    <div className="empty-state-icon">📡</div>
                    <div className="empty-state-text">Select a trip and press Start to begin analysis.</div>
                </div>
            )}

            {flags.length === 0 && isFusionStreaming && (
                <div className="empty-state">
                    <div className="empty-state-icon" style={{ fontSize: '2rem' }}>⏳</div>
                    <div className="empty-state-text">Processing… flagged events will appear here shortly.</div>
                </div>
            )}

            {flags.length === 0 && isFusionDone && (
                <div className="empty-state">
                    <div className="empty-state-icon">✅</div>
                    <div className="empty-state-text">No conflicts detected.</div>
                </div>
            )}

            {flags.length > 0 && (
                <div className="events-list" style={{ marginBottom: '1rem' }}>
                    {[...flags].reverse().map((flag, idx) => (
                        <FlagCard key={flag.flag_id} flag={flag} index={idx} />
                    ))}
                </div>
            )}

            {/* ── Fusion summary bar ───────────────────────────────────── */}
            {isFusionDone && summary && (
                <div
                    className="done-banner"
                    style={{ color: summary.flag_count > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}
                >
                    {summary.flag_count} flags · {summary.motion_count} motion windows ·{' '}
                    {summary.audio_count} audio spikes · processed in {summary.duration_ms}ms
                </div>
            )}

            {/* ── Section 2: SENSOR DATA (collapsible) ─────────────────── */}
            {(filteredMotion.length > 0 || filteredAudio.length > 0 || allDone) && (
                <div style={{ marginTop: '1rem' }}>
                    <button
                        className="btn-secondary"
                        style={{ width: '100%', marginBottom: '0.5rem', textAlign: 'left' }}
                        onClick={() => setSensorOpen((o) => !o)}
                    >
                        {sensorOpen ? '▾' : '▸'} Sensor data ({filteredMotion.length} motion, {filteredAudio.length} audio)
                    </button>

                    {sensorOpen && (
                        <>
                            {allDone && (filteredMotion.length > 0 || filteredAudio.length > 0) && (
                                <div className="done-banner">
                                    ✅ Analysis complete — {filteredMotion.length} motion, {filteredAudio.length} audio events
                                </div>
                            )}

                            {(filteredMotion.length > 0 || filteredAudio.length > 0) && (
                                <div className="events-list">
                                    {[
                                        ...filteredMotion.map(e => ({ source: 'motion' as const, data: e, t: e.elapsed_s })),
                                        ...filteredAudio.map(e => ({ source: 'audio' as const, data: e, t: e.elapsed_s })),
                                    ]
                                        .sort((a, b) => b.t - a.t)
                                        .map((item, idx) => {
                                            if (item.source === 'audio') {
                                                return <AudioEventCard key={(item.data as AudioEvent).event_id} event={item.data as AudioEvent} index={idx} />
                                            }
                                            const e = item.data as MotionEvent
                                            return (
                                                <div key={e.event_id} className="event-card" style={{ borderLeft: '3px solid #f97316' }}>
                                                    <div className={`event-icon ${e.event_type}`}>{MOTION_ICONS[e.event_type]}</div>
                                                    <div className="event-info">
                                                        <span className={`event-type-badge ${e.event_type}`}>{MOTION_LABELS[e.event_type]}</span>
                                                        <div className="event-explanation">{e.explanation}</div>
                                                    </div>
                                                    <div className="event-meta">
                                                        <div className="event-score">{(e.score * 100).toFixed(0)}%</div>
                                                        <div className="event-time">t={formatElapsed(e.elapsed_s)}</div>
                                                        <div className="score-bar-container">
                                                            <div className={`score-bar ${e.event_type}`} style={{ width: `${e.score * 100}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
