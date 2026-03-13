import { FlagEvent, FlagType, FlagSeverity } from '../shared/types'

interface FlagCardProps {
    flag: FlagEvent
    index: number
}

function formatElapsed(s: number): string {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
}

const FLAG_TYPE_CONFIG: Record<FlagType, { label: string; icon: string; bg: string }> = {
    [FlagType.conflict_moment]: { label: 'CONFLICT', icon: '⚡', bg: '#dc2626' },
    [FlagType.motion_only]: { label: 'MOTION', icon: '🚗', bg: '#ea580c' },
    [FlagType.audio_only]: { label: 'AUDIO', icon: '🔊', bg: '#2563eb' },
}

const SEVERITY_COLOR: Record<FlagSeverity, string> = {
    [FlagSeverity.high]: '#ef4444',
    [FlagSeverity.medium]: '#f59e0b',
    [FlagSeverity.low]: '#60a5fa',
}

function ScoreBar({
    label,
    score,
    noData,
    color,
}: {
    label: string
    score: number
    noData: boolean
    color: string
}) {
    return (
        <div className="flag-score-bar-wrap">
            <span className="flag-score-label">{label}</span>
            {noData ? (
                <span className="flag-score-nodata">—</span>
            ) : (
                <>
                    <div className="flag-score-track">
                        <div
                            className="flag-score-fill"
                            style={{ width: `${Math.round(score * 100)}%`, background: color }}
                        />
                    </div>
                    <span className="flag-score-value">{score.toFixed(2)}</span>
                </>
            )}
        </div>
    )
}

export default function FlagCard({ flag, index }: FlagCardProps) {
    const typeConfig = FLAG_TYPE_CONFIG[flag.flag_type]
    const accentColor = SEVERITY_COLOR[flag.severity]
    const animDelay = `${index * 50}ms`

    const isMotionOnly = flag.flag_type === FlagType.motion_only
    const isAudioOnly = flag.flag_type === FlagType.audio_only

    return (
        <div
            className="flag-card"
            style={{
                borderLeft: `4px solid ${accentColor}`,
                animationDelay: animDelay,
            }}
        >
            {/* Top row */}
            <div className="flag-card-top">
                <span
                    className="flag-type-badge"
                    style={{ background: typeConfig.bg }}
                >
                    {typeConfig.icon} {typeConfig.label}
                </span>
                <span
                    className="flag-severity-pill"
                    style={{ color: accentColor, borderColor: accentColor }}
                >
                    {flag.severity.toUpperCase()}
                </span>
                <span className="flag-elapsed">{formatElapsed(flag.elapsed_s)}</span>
                <span className="flag-combined-score">Score: {flag.combined_score.toFixed(2)}</span>
            </div>

            {/* Explanation */}
            <div className="flag-explanation">{flag.explanation}</div>

            {/* Bottom row */}
            <div className="flag-card-bottom">
                <span className="flag-context">{flag.context}</span>
                <div className="flag-scores">
                    <ScoreBar
                        label="Motion"
                        score={flag.motion_score}
                        noData={isAudioOnly}
                        color="#f97316"
                    />
                    <ScoreBar
                        label="Audio"
                        score={flag.audio_score}
                        noData={isMotionOnly}
                        color="#38bdf8"
                    />
                </div>
            </div>
        </div>
    )
}
