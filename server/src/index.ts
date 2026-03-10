import express from "express"
import cors from "cors"

import tripsRouter from "./routes/trips"
import motionEventsRouter from "./routes/motionEvents"
import audioRoutes from "./routes/audioEvents"
import fusionRoutes, { createFlagsRouter } from "./routes/fusion"
import earningsRouter from "./routes/earnings"
import demoRouter from "./routes/demoRouter"
import pastTripsRouter from "./routes/pastTrips"

import { wipeDemoData } from "./db/devReset"

import * as path from "path"

import { CsvLoader } from "./loaders/csvLoader"
import { AccelLoader } from "./loaders/accelLoader"
import { AudioLoader } from "./loaders/audioLoader"
import { DataPreprocessor } from "./loaders/dataPreprocessor"

const app = express()

// IMPORTANT: Render requires this
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: [
    "http://localhost:5173",
    process.env.CLIENT_URL || "",
    "https://uber-hackthon-dm6d.vercel.app"
  ].filter(Boolean)
}))
app.use(express.json())

app.use("/api/trips", tripsRouter)
app.use("/api/motion", motionEventsRouter)
app.use("/api/audio", audioRoutes)
app.use("/api/fusion", fusionRoutes)
app.use("/api/flags", createFlagsRouter())
app.use("/api/driver", earningsRouter)
app.use("/api/demo", demoRouter)
app.use("/api/past-trips", pastTripsRouter)

app.listen(PORT, async () => {

  try {

    // Wipe demo data
    await wipeDemoData()

    // Run preprocessing
    DataPreprocessor.run()

    const csvLoader = new CsvLoader()

    // FIXED PATHS
    const accelLoader = new AccelLoader(
      csvLoader,
      path.resolve(process.cwd(), "src/data/clean_accelerometer.csv")
    )

    const audioLoader = new AudioLoader(
      csvLoader,
      path.resolve(process.cwd(), "src/data/clean_audio.csv")
    )

    const motionTrips = accelLoader.getAvailableTrips()
    const audioTrips = audioLoader.getAvailableTrips()

    console.log(`🚗 Driver Pulse Server ready on :${PORT}`)
    console.log(`📊 Available trips (motion): ${motionTrips.join(", ")}`)
    console.log(`🎵 Available trips (audio):  ${audioTrips.join(", ")}`)
    console.log(`⚡ Fusion endpoint: /api/fusion/:tripId`)

  } catch (err) {
    console.error("Server startup error:", err)
  }

})



export default app