import { Router } from 'express'
import path from 'path'
import { EarningsLoader } from '../engine/earningsEngine'

const router = Router()

// Initialize a singleton instance of the Engine
const engine = new EarningsLoader(
    path.join(__dirname, '../data/driver_goals.csv'),
    path.join(__dirname, '../data/earnings_velocity_log.csv'),
    path.join(__dirname, '../data/trips.csv')
)

// The engine takes a moment to load and sort CSVs into memory maps 
// We start this immediately when the route module is imported
engine.loadData().then(() => {
    console.log('💰 Earnings Engine loaded successfully')
}).catch(console.error)

router.get('/:driverId/dashboard', (req, res) => {
    const { driverId } = req.params
    const data = engine.getDriverDashboardData(driverId)

    if (!data || !data.goal) {
        return res.status(404).json({ error: 'Driver profile not found.' })
    }

    res.json(data)
})

export default router
