import { Router } from 'express'
import * as path from 'path'
import { CsvLoader } from '../loaders/csvLoader'
import { AccelLoader } from '../loaders/accelLoader'

const router = Router()

const CSV_PATH = path.join(__dirname, '../data/accelerometer_data.csv')

router.get('/', (_req, res) => {
    const csvLoader = new CsvLoader()
    const accelLoader = new AccelLoader(csvLoader, CSV_PATH)
    const trips = accelLoader.getAvailableTrips()
    res.json(trips)
})

export default router
