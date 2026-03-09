export const audioEventsSchema = `
  CREATE TABLE IF NOT EXISTS audio_events (
    event_id    VARCHAR(36)    PRIMARY KEY,
    trip_id     VARCHAR(10)    NOT NULL,
    driver_id   VARCHAR(10)    NOT NULL,
    timestamp   DATETIME       NOT NULL,
    elapsed_s   INT            NOT NULL,
    peak_db     DECIMAL(5,2)   NOT NULL,
    avg_db      DECIMAL(5,2)   NOT NULL,
    duration_s  INT            NOT NULL,
    audio_class ENUM('quiet','normal','conversation','loud','very_loud','argument')  NOT NULL,
    severity    ENUM('SHORT_LOW','SHORT_MODERATE','SHORT_HIGH','SHORT_CRITICAL','MODERATE_SPIKE','HIGH_SPIKE','CRITICAL_SPIKE')  NOT NULL,
    is_sustained TINYINT(1)    NOT NULL,
    score       DECIMAL(4,3)   NOT NULL,
    created_at  DATETIME       NOT NULL DEFAULT NOW(),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
  );
`;
