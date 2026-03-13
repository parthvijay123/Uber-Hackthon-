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
import { exec } from "child_process"
import util from "util"
const execAsync = util.promisify(exec)

import * as fs from "fs"
import * as path from "path"

import { CsvLoader } from "./loaders/csvLoader"
import { AccelLoader } from "./loaders/accelLoader"
import { AudioLoader } from "./loaders/audioLoader"

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

app.get("/api/db-init", async (req, res) => {
    try {
        console.log("Starting manual DB initialization...");
        const { stdout: schemaOut } = await execAsync("node dist/src/db/setupSchema.js");
        console.log("Schema Init:", schemaOut);
        
        const { stdout: seedOut } = await execAsync("node dist/src/db/seedDriverGoals.js");
        console.log("Seed Init:", seedOut);

        res.json({ success: true, message: "Database initialized successfully.", schemaOut, seedOut });
    } catch (err: any) {
        console.error("DB Init Error:", err);
        res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
});

app.listen(PORT, async () => {

  try {

    // Wipe demo data
    await wipeDemoData()

    // Run preprocessing - REMOVED AS PER USER REQUEST
    // DataPreprocessor.run()

    const csvLoader = new CsvLoader()

    const dataDir = path.resolve(process.cwd(), "src/data")
    
    // Dynamically list all trip files
    const accelFiles = fs.readdirSync(dataDir)
      .filter(f => f.endsWith("_accelerometer_data.csv"))
      .map(f => path.join(dataDir, f))
    
    const audioFiles = fs.readdirSync(dataDir)
      .filter(f => f.endsWith("_audio_data.csv"))
      .map(f => path.join(dataDir, f))

    const accelLoader = new AccelLoader(csvLoader, accelFiles)
    const audioLoader = new AudioLoader(csvLoader, audioFiles)

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