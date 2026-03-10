import { useState, useEffect, useRef, useCallback } from 'react'
import { AudioEvent } from '../shared/types'

const API_BASE = 'http://localhost:3001/api'

interface UseAudioStreamResult {
    events: AudioEvent[]
    isStreaming: boolean
    isDone: boolean
    reset: () => void
}

export function useAudioStream(tripId: string | null): UseAudioStreamResult {
    const [events, setEvents] = useState<AudioEvent[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const [isDone, setIsDone] = useState(false)
    const eventSourceRef = useRef<EventSource | null>(null)

    const stop = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
        setIsStreaming(false)
    }, [])

    const reset = useCallback(() => {
        stop()
        setEvents([])
        setIsDone(false)
    }, [stop])

    useEffect(() => {
        if (!tripId) return
        stop()
        setEvents([])
        setIsDone(false)
        setIsStreaming(true)

        const es = new EventSource(`${API_BASE}/audio/${tripId}/stream`)
        eventSourceRef.current = es

        es.onmessage = (e) => {
            if (e.data === 'DONE') {
                setIsStreaming(false)
                setIsDone(true)
                es.close()
                eventSourceRef.current = null
                return
            }
            if (e.data === 'ERROR') {
                setIsStreaming(false)
                es.close()
                return
            }
            try {
                const event: AudioEvent = JSON.parse(e.data)
                // Use functional update to avoid stale closure
                setEvents((prev) => [...prev, event])
            } catch {
                // ignore
            }
        }

        es.onerror = () => {
            setIsStreaming(false)
            setIsDone(true)
            es.close()
        }

        return () => stop()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tripId])

    return { events, isStreaming, isDone, reset }
}
