import { AudioEvent, AudioSeverity } from '../../../shared/types'

interface AudioEventCardProps {
    event: AudioEvent
    index: number
}

const SEVERITY_COLORS: Record<AudioSeverity, { bg: string; color: string; text: string }> = {
    [AudioSeverity.CRITICAL_SPIKE]: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', text: 'CRITICAL' },
    [AudioSeverity.HIGH_SPIKE]: { bg: 'rgba(249,115,22,0.18)', color: '#f97316', text: 'HIGH SPIKE' },
    [AudioSeverity.MODERATE_SPIKE]: { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b', text: 'MODERATE SPIKE' },
    [AudioSeverity.SHORT_CRITICAL]: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', text: 'SHORT CRITICAL' },
    [AudioSeverity.SHORT_HIGH]: { bg: 'rgba(249,115,22,0.12)', color: '#fb923c', text: 'SHORT HIGH' },
    [AudioSeverity.SHORT_MODERATE]: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', text: 'SHORT MODERATE' },
    [AudioSeverity.SHORT_LOW]: { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', text: 'SHORT LOW' },
}

function formatElapsed(s: number): string {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
}

export default function AudioEventCard({ event, index }: AudioEventCardProps) {
    const sev = SEVERITY_COLORS[event.severity]
    const barWidth = Math.min((event.peak_db / 100) * 100, 100)

    return (
        <div
            className="audio-event-card"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            {/* Left accent */}
            <div className="audio-left-accent" style={{ background: sev.color }} />

            {/* Icon */}
            <div className="audio-icon" style={{ background: sev.bg, color: sev.color }}>
                🎵
            </div>

            {/* Info */}
            <div className="audio-info">
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    <span
                        className="event-type-badge"
                        style={{ background: sev.bg, color: sev.color }}
                    >
                        {sev.text}
                    </span>
                    <span className="audio-class-badge">{event.audio_class.replace('_', ' ')}</span>
                    {event.is_sustained && (
                        <span className="sustained-pill">SUSTAINED</span>
                    )}
                </div>
                <div className="audio-db-row">
                    <span className="audio-mag">+{event.magnitude_db.toFixed(1)} dB above baseline</span>
                </div>
                {/* dB bar */}
                <div className="audio-bar-container">
                    <div
                        className="audio-bar"
                        style={{ width: `${barWidth}%`, background: sev.color }}
                    />
                </div>
                <div className="audio-meta-row">
                    <span>Peak: <strong style={{ color: sev.color }}>{event.peak_db} dB</strong></span>
                    <span>Avg: {event.avg_db.toFixed(1)} dB</span>
                    <span>Duration: {event.duration_s.toFixed(1)}s</span>
                </div>
            </div>

            {/* Time */}
            <div className="event-meta">
                <div className="event-time" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    t={formatElapsed(event.elapsed_s)}
                </div>
            </div>
        </div>
    )
}
