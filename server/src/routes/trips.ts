import { Router } from 'express'
import * as path from 'path'
import { CsvLoader } from '../loaders/csvLoader'
import { AccelLoader } from '../loaders/accelLoader'

const router = Router()

const DATA_DIR = path.join(__dirname, '../data')

router.get('/', (_req, res) => {
    const csvLoader = new CsvLoader()
    const accelLoader = new AccelLoader(csvLoader, [
        path.join(DATA_DIR, 'TRIP221_accelerometer_data.csv'),
        path.join(DATA_DIR, 'TRIP222_accelerometer_data.csv'),
        path.join(DATA_DIR, 'TRIP223_accelerometer_data.csv'),
    ])
    const trips = accelLoader.getAvailableTrips()
    res.json(trips)
})


export default router
