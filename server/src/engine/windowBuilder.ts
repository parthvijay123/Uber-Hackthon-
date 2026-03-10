import { AccelSample, BatchWindow } from '../shared/types'

export class WindowBuilder {
    buildWindows(samples: AccelSample[], windowSizeSeconds: number): BatchWindow[] {
      
        const sorted = [...samples].sort((a, b) => a.elapsed_s - b.elapsed_s)


        const buckets = new Map<number, AccelSample[]>()
        for (const sample of sorted) {
            const bucketIdx = Math.floor(sample.elapsed_s / windowSizeSeconds)
            if (!buckets.has(bucketIdx)) {
                buckets.set(bucketIdx, [])
            }
            buckets.get(bucketIdx)!.push(sample)
        }

        const windows: BatchWindow[] = []
        for (const [, bucket] of [...buckets.entries()].sort(([a], [b]) => a - b)) {
            if (bucket.length === 0) continue

            const t_start = Math.min(...bucket.map((s) => s.elapsed_s))
            const t_end = Math.max(...bucket.map((s) => s.elapsed_s))
            const trip_id = bucket[0].trip_id
            const window_id = `${trip_id}_${t_start}`

            windows.push({ window_id, trip_id, t_start, t_end, samples: bucket })
        }

        return windows
    }
}