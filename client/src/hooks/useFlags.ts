import { useState, useEffect, useRef, useCallback } from 'react'
import { FlagEvent } from '../shared/types'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')

interface FusionSummary {
    motion_count: number
    audio_count: number
    flag_count: number
    duration_ms: number
}

interface UseFusionStreamResult {
    flags: FlagEvent[]
    summary: FusionSummary | null
    isStreaming: boolean
    isDone: boolean
    reset: () => void
}

export function useFusionStream(tripId: string | null): UseFusionStreamResult {
    const [flags, setFlags] = useState<FlagEvent[]>([])
    const [summary, setSummary] = useState<FusionSummary | null>(null)
    const [isStreaming, setIsStreaming] = useState(false)
    const [isDone, setIsDone] = useState(false)
    const esRef = useRef<EventSource | null>(null)

    const stop = useCallback(() => {
        if (esRef.current) {
            esRef.current.close()
            esRef.current = null
        }
        setIsStreaming(false)
    }, [])

    const reset = useCallback(() => {
        stop()
        setFlags([])
        setSummary(null)
        setIsDone(false)
    }, [stop])

    useEffect(() => {
        if (!tripId) return
        stop()
        setFlags([])
        setSummary(null)
        setIsDone(false)
        setIsStreaming(true)

        const es = new EventSource(`${API_BASE}/fusion/${tripId}/stream`)
        esRef.current = es

        es.onmessage = (e) => {
            // Handle SUMMARY before DONE check
            if (e.data.startsWith('SUMMARY:')) {
                const json = e.data.replace('SUMMARY:', '')
                try {
                    setSummary(JSON.parse(json))
                } catch { /* ignore */ }
                return
            }
            if (e.data === 'DONE') {
                setIsStreaming(false)
                setIsDone(true)
                es.close()
                esRef.current = null
                return
            }
            if (e.data === 'ERROR') {
                setIsStreaming(false)
                setIsDone(true)
                es.close()
                return
            }
            try {
                const flag: FlagEvent = JSON.parse(e.data)
                // Functional update to avoid stale closure
                setFlags((prev) => [...prev, flag])
            } catch { /* ignore */ }
        }

        es.onerror = () => {
            setIsStreaming(false)
            setIsDone(true)
            es.close()
        }

        return () => stop()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tripId])

    return { flags, summary, isStreaming, isDone, reset }
}
