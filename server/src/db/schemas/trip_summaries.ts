export const tripSummariesSchema = `
  CREATE TABLE IF NOT EXISTS trip_summaries (
    trip_id                VARCHAR(10)   PRIMARY KEY,
    driver_id              VARCHAR(10)   NOT NULL,
    date                   DATE          NOT NULL,
    duration_min           SMALLINT,
    distance_km            DECIMAL(6,2),
    fare                   DECIMAL(8,2),
    earnings_velocity      DECIMAL(8,2),
    motion_events_count    SMALLINT      DEFAULT 0,
    audio_events_count     SMALLINT      DEFAULT 0,
    flagged_moments_count  SMALLINT      DEFAULT 0,
    max_severity           ENUM('none','low','medium','high'),
    stress_score           DECIMAL(4,3),
    trip_quality_rating    ENUM('excellent','good','fair','poor'),
    created_at             DATETIME      NOT NULL DEFAULT NOW(),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
  );
`;
