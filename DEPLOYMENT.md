# Driver Pulse — Complete Deployment Guide

## Overview

**Stack:**   
- **Frontend** — React + TypeScript + Vite (port 5173 dev / 80 prod)  
- **Backend** — Node.js + Express + TypeScript (port 3001)  
- **Database** — MySQL 8.x  
- **Data** — CSV sensor files pre-processed at server startup  

---

## 1. Prerequisites

Install the following on your deployment machine before anything else.

### 1.1 Node.js ≥ 18

```bash
# macOS (Homebrew)
brew install node@18
node --version   # must be ≥ 18.0.0
npm --version    # must be ≥ 9.0.0

# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 1.2 MySQL 8.x

```bash
# macOS
brew install mysql@8.0
brew services start mysql@8.0

# Ubuntu / Debian
sudo apt-get install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

### 1.3 Git

```bash
# macOS
brew install git

# Ubuntu
sudo apt-get install -y git
```

---

## 2. Clone the Repository

```bash
git clone <YOUR_REPO_URL> DriverPulse
cd DriverPulse/Uber-Hackthon-
```

---

## 3. Database Setup

### 3.1 Secure MySQL installation (production only)

```bash
sudo mysql_secure_installation
# Follow prompts: set root password, remove anonymous users, disable remote root login
```

### 3.2 Create the database and application user

```bash
mysql -u root -p
```

Inside the MySQL shell:

```sql
CREATE DATABASE driver_pulse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'dp_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON driver_pulse.* TO 'dp_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3.3 Configure the server environment file

```bash
cd server
cp .env .env.backup  # keep a backup
nano .env
```

Set the following values:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=dp_user
DB_PASSWORD=YOUR_STRONG_PASSWORD
DB_NAME=driver_pulse
PORT=3001
```

Save and exit (Ctrl+O, Enter, Ctrl+X).

### 3.4 Create database schema

```bash
# From the server/ directory
npx ts-node src/db/setupSchema.ts
```

Expected output:
```
✅ Schema created successfully.
```

### 3.5 Seed driver goals

```bash
npx ts-node src/db/seedDriverGoals.ts
```

Expected output:
```
✅ Seeded 200 driver goals and N drivers.
```

---

## 4. Install Dependencies

### 4.1 Server

```bash
cd server
npm install
```

### 4.2 Client

```bash
cd ../client
npm install
```

---

## 5. Running in Development

Open **two separate terminal tabs**.

### Terminal 1 — Backend server

```bash
cd server
npm run dev
```

Expected startup output:
```
🚗 Driver Pulse Server ready on :3001
📊 Available trips (motion): TRIP221, TRIP222, TRIP223
🎵 Available trips (audio):  TRIP221, TRIP222, TRIP223
⚡ Fusion endpoint: /api/fusion/:tripId
```

> The server automatically runs the data preprocessor on every startup, generating
> `clean_accelerometer.csv` and `clean_audio.csv` from the per-trip sensor files.

### Terminal 2 — Frontend dev server

```bash
cd client
npm run dev
```

Expected output:
```
  VITE v5.x  ready in Xms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

---

## 6. Building for Production

### 6.1 Build the client

```bash
cd client
npm run build
```

Output is written to `client/dist/`.

### 6.2 Important: update the API base URL before building

Before running `npm run build`, change `const API_BASE` in the following files to use `/api` (nginx proxy) or your production domain:

| File | Variable to change |
|------|-------------------|
| `client/src/App.tsx` | `const API_BASE` |
| `client/src/components/DemoTripPicker.tsx` | `const API_BASE` |
| `client/src/components/MasterDashboard.tsx` | `const API_BASE` |
| `client/src/components/PastTrips.tsx` | `const API_BASE` |
| `client/src/hooks/useAudioStream.ts` | `const API_BASE` |
| `client/src/hooks/useFlags.ts` | `const API_BASE` |

**Example change** (using nginx proxy):
```typescript
// Before
const API_BASE = 'http://localhost:3001/api'
// After
const API_BASE = '/api'
```

### 6.3 Serve with nginx (recommended)

```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/driver-pulse
```

Paste:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve the React build
    root /path/to/Uber-Hackthon-/client/dist;
    index index.html;

    # SPA fallback — all unknown paths serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy all /api calls to the Node.js server
    location /api/ {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
        # Required for Server-Sent Events (SSE) streams
        proxy_buffering    off;
        proxy_read_timeout 3600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/driver-pulse /etc/nginx/sites-enabled/
sudo nginx -t              # verify config syntax
sudo systemctl restart nginx
```

---

## 7. Running the Backend in Production (PM2)

Use **PM2** to keep the Express server alive across crashes and reboots.

```bash
npm install -g pm2

cd server
pm2 start "npm run dev" --name driver-pulse-server

pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

Useful PM2 commands:

```bash
pm2 status                      # show all running apps
pm2 logs driver-pulse-server    # tail logs
pm2 restart driver-pulse-server # restart after code change
pm2 stop driver-pulse-server    # graceful stop
```

---

## 8. HTTPS / SSL (Production — Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Follow prompts — certbot auto-patches the nginx config
sudo systemctl reload nginx
```

Verify auto-renewal:

```bash
sudo certbot renew --dry-run
```

---

## 9. CORS Configuration for Production

The server's default CORS allows only `localhost`. For production, update `server/src/index.ts`:

```typescript
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://your-domain.com',   // ← add your production domain
    ]
}))
```

Rebuild and restart the server after this change.

---

## 10. Data Files Reference

All CSV data lives in `server/src/data/`:

| File | Description |
|------|-------------|
| `TRIP221_accelerometer_data.csv` | Accelerometer sensor data for demo trip 1 |
| `TRIP222_accelerometer_data.csv` | Accelerometer sensor data for demo trip 2 |
| `TRIP223_accelerometer_data.csv` | Accelerometer sensor data for demo trip 3 |
| `TRIP221_audio_data.csv` | Audio intensity data for demo trip 1 |
| `TRIP222_audio_data.csv` | Audio intensity data for demo trip 2 |
| `TRIP223_audio_data.csv` | Audio intensity data for demo trip 3 |
| `trips.csv` | Historical trip records (220+ trips + TRIP221/222/223 for DRV001) |
| `driver_goals.csv` | Driver goal targets for earnings velocity |
| `clean_accelerometer.csv` | **Auto-generated** at server startup — do not edit manually |
| `clean_audio.csv` | **Auto-generated** at server startup — do not edit manually |

> **Important:** `clean_accelerometer.csv` and `clean_audio.csv` are regenerated every
> time the server starts. Delete them manually to force regeneration.

---

## 11. Full Smoke Test Checklist

Run these commands after each deployment to verify the system:

```bash
# 1. Database connection
mysql -u dp_user -p driver_pulse -e "SHOW TABLES;"

# 2. Demo trips API
curl http://localhost:3001/api/demo/trips
# ✓ JSON array: TRIP221, TRIP222, TRIP223 with status 'available'

# 3. Past trips API
curl http://localhost:3001/api/past-trips/DRV001
# ✓ JSON array with at least 6 trips (TRIP048, TRIP151, TRIP153, TRIP221-223)

# 4. Sensor fusion endpoint
curl http://localhost:3001/api/fusion/TRIP221
# ✓ JSON with motion_events[], audio_events[], flag_events[]

# 5. Dashboard data for DRV001
curl http://localhost:3001/api/driver/DRV001/dashboard
# ✓ JSON with goal.target_earnings, recentTrips[], velocityLogs[]

# 6. Browser test
# Open http://localhost:5173
# Login with "DRV001"
# Dashboard loads with earnings gauge
# Click "🗂 Past Trips" → grid of trip cards with flag counts for simulated trips
# Click "+ New Trip" → picker shows TRIP221, TRIP222, TRIP223
# Start TRIP221 → sensor simulation streams events into the timeline
# After simulation completes → velocity gauge updates
```

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `ENOENT: TRIP221_accelerometer_data.csv` | Older code reference to TRIP001 | Check `dataPreprocessor.ts`, `fusion.ts`, `trips.ts` |
| Dashboard shows "Driver profile not found" | `driver_goals` table empty | Re-run `npx ts-node src/db/seedDriverGoals.ts` |
| Past Trips shows empty for DRV001 | trips.csv missing TRIP221/222/223 rows | Add rows to trips.csv — see Section 10 |
| 0 flags/events after simulation | `clean_accelerometer.csv` has wrong trip_ids | Delete clean CSVs and restart server |
| Port 3001 already in use | Stale process | `lsof -ti:3001 \| xargs kill -9` |
| Velocity gauge not updating | Trip completion endpoint failed | Check `pm2 logs` for `[Demo] complete error` |
| SSE stream drops immediately | nginx proxy buffering enabled | Add `proxy_buffering off` to nginx `/api/` block |
| Stress scores look wrong | Old clean CSVs cached with TRIP001 data | Delete clean CSVs, restart server |
| MySQL refuses connection | Wrong credentials in .env | Double-check DB_USER / DB_PASSWORD |

---

## 13. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | `localhost` | MySQL server hostname |
| `DB_PORT` | No | `3306` | MySQL server port |
| `DB_USER` | Yes | — | MySQL username |
| `DB_PASSWORD` | Yes | — | MySQL password |
| `DB_NAME` | Yes | `driver_pulse` | Target database name |
| `PORT` | No | `3001` | Express server listening port |

---

## 14. Architecture Overview

```
Browser (React/Vite :5173 dev / :80 prod via nginx)
         │
         │  HTTP + Server-Sent Events
         ▼
Express Server (Node.js :3001)
    ├─ /api/demo/*          Trip simulation (start, stream, complete)
    ├─ /api/motion/*        Accelerometer SSE stream
    ├─ /api/audio/*         Audio SSE stream
    ├─ /api/fusion/*        Fusion (motion+audio→incidents) SSE stream
    ├─ /api/flags/*         Stored flag events (from EventStore)
    ├─ /api/driver/*        Dashboard data (MySQL queries)
    └─ /api/past-trips/*    Historical trips (CSV + MySQL enrichment)
              │
              ├─ DataPreprocessor   Runs on startup; cleans sensor CSVs
              ├─ MotionProcessor    Accelerometer windows → motion events
              ├─ AudioProcessor     Audio samples → spike events
              └─ FusionEvaluator    Merges events → real-life incidents
                        │
                        ▼
              MySQL 8.x (driver_pulse)
                ├─ drivers
                ├─ driver_goals
                ├─ trips
                ├─ motion_events
                ├─ audio_events
                ├─ flag_events
                ├─ trip_summaries
                └─ earnings_velocity_log
```
