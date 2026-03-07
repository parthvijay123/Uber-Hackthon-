import express from 'express'
import cors from 'cors'
import tripsRouter from './routes/trips'
import motionEventsRouter from './routes/motionEvents'
import * as path from 'path'
import { CsvLoader } from './loaders/csvLoader'
import { AccelLoader } from './loaders/accelLoader'

const app = express()
const PORT = 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/trips', tripsRouter)
app.use('/api/motion', motionEventsRouter)

app.listen(PORT, () => {
    const csvLoader = new CsvLoader()
    const accelLoader = new AccelLoader(
        csvLoader,
        path.join(__dirname, 'data/accelerometer_data.csv')
    )
    const trips = accelLoader.getAvailableTrips()
    console.log(`🚗 Driver Pulse Server running on http://localhost:${PORT}`)
    console.log(`📊 Available trips: ${trips.join(', ')}`)
})

export default app
