import express from 'express'
import cors from 'cors'
import tripsRouter from './routes/trips'
import motionEventsRouter from './routes/motionEvents'
import audioRoutes from './routes/audioEvents'
import fusionRoutes, { createFlagsRouter } from './routes/fusion'
import earningsRouter from './routes/earnings'
import demoRouter from './routes/demoRouter'
import { wipeDemoData } from './db/devReset'
import * as path from 'path'
import { CsvLoader } from './loaders/csvLoader'
import { AccelLoader } from './loaders/accelLoader'
import { AudioLoader } from './loaders/audioLoader'
import { DataPreprocessor } from './loaders/dataPreprocessor'

const app = express()
const PORT = 3001

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }))
app.use(express.json())

app.use('/api/trips', tripsRouter)
app.use('/api/motion', motionEventsRouter)
app.use('/api/audio', audioRoutes)
app.use('/api/fusion', fusionRoutes)
app.use('/api/flags', createFlagsRouter())
app.use('/api/driver', earningsRouter)
app.use('/api/demo', demoRouter)

app.listen(PORT, async () => {
    // Wipe demo data on every dev restart for a clean test slate
    await wipeDemoData()

    // RUN PREPROCESSOR BEFORE INITIALIZING LOADERS
    DataPreprocessor.run()

    const csvLoader = new CsvLoader()
    const accelLoader = new AccelLoader(
        csvLoader,
        path.join(__dirname, 'data/clean_accelerometer.csv')
    )
    const audioLoader = new AudioLoader(
        csvLoader,
        path.join(__dirname, 'data/clean_audio.csv')
    )
    const motionTrips = accelLoader.getAvailableTrips()
    const audioTrips = audioLoader.getAvailableTrips()
    console.log(`🚗 Driver Pulse Server ready on :${PORT}`)
    console.log(`📊 Available trips (motion): ${motionTrips.join(', ')}`)
    console.log(`🎵 Available trips (audio):  ${audioTrips.join(', ')}`)
    console.log(`⚡ Fusion endpoint: /api/fusion/:tripId`)
})

export default app
