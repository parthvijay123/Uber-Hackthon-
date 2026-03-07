import * as fs from 'fs'
import * as path from 'path'

export class CsvLoader {
    parseWithHeaders<T>(
        filePath: string,
        mapFn: (row: Record<string, string>) => T
    ): T[] {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').map((l) => l.trim())

        if (lines.length === 0) return []

        const headers = lines[0].split(',').map((h) => h.trim())
        const results: T[] = []

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i]
            if (!line) continue

            const values = line.split(',')
            const row: Record<string, string> = {}
            headers.forEach((header, idx) => {
                row[header] = (values[idx] ?? '').trim()
            })

            results.push(mapFn(row))
        }

        return results
    }
}
