import express, { Request, Response } from 'express'
import cors from 'cors'
import pool from './db/mysqlClient'
import tripsRouter from './routes/trips'
import motionEventsRouter from './routes/motionEvents'
import audioRoutes from './routes/audioEvents'
import fusionRoutes, { createFlagsRouter } from './routes/fusion'
import earningsRouter from './routes/earnings'
import demoRouter from './routes/demoRouter'
import { wipeDemoData, seedDemoProfile } from './db/devReset'
import { setupSchema } from './db/setupSchema'
import * as path from 'path'
import { CsvLoader } from './loaders/csvLoader'
import { AccelLoader } from './loaders/accelLoader'
import { AudioLoader } from './loaders/audioLoader'
import { DataPreprocessor } from './loaders/dataPreprocessor'

const app = express()
const PORT = process.env.PORT || 3001

// Enable CORS for all origins for easier testing during hackathon
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
    try {
        const [result]: any = await pool.query('SELECT 1 + 1 AS result');
        res.json({ status: 'ok', database: 'connected', test: result[0].result });
    } catch (err: any) {
        res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
    }
});

app.use('/api/trips', tripsRouter)
app.use('/api/motion', motionEventsRouter)
app.use('/api/audio', audioRoutes)
app.use('/api/fusion', fusionRoutes)
app.use('/api/flags', createFlagsRouter())
app.use('/api/driver', earningsRouter)
app.use('/api/demo', demoRouter)

app.listen(PORT, async () => {
    try {
        console.log(`\nInitializing database on Railway...`);
        // 1. Create all tables if they don't exist
        await setupSchema()

        // 2. Seed demo driver and goal so dashboard can load immediately
        await seedDemoProfile()

        // 3. Wipe demo trip data for a clean slate
        await wipeDemoData()

        // 4. RUN PREPROCESSOR (optional, commented out) BEFORE INITIALIZING LOADERS (only in dev or if files missing)
        // DataPreprocessor.run()

        console.log(`\n🚗 Driver Pulse Server ready on :${PORT}`)
        console.log(`⚡ Fusion endpoint: /api/fusion/:tripId`)
    } catch (err: any) {
        console.error(`❌ Server initialization failed:`, err.message);
    }
})

export default app
