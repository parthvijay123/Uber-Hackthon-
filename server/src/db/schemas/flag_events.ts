export const flagEventsSchema = `
  CREATE TABLE IF NOT EXISTS flag_events (
    flag_id          VARCHAR(10)    PRIMARY KEY,
    trip_id          VARCHAR(10)    NOT NULL,
    driver_id        VARCHAR(10)    NOT NULL,
    motion_event_id  VARCHAR(36),
    audio_event_id   VARCHAR(36),
    timestamp        DATETIME       NOT NULL,
    elapsed_s        INT            NOT NULL,
    flag_type        ENUM('conflict_moment','sustained_stress','audio_spike','harsh_braking','moderate_brake')  NOT NULL,
    severity         ENUM('low','medium','high')   NOT NULL,
    motion_score     DECIMAL(4,3)   NOT NULL,
    audio_score      DECIMAL(4,3)   NOT NULL,
    combined_score   DECIMAL(4,3)   NOT NULL,
    explanation      TEXT           NOT NULL,
    context          VARCHAR(200)   NOT NULL,
    upload_status    ENUM('PENDING','SENT','FAILED')  NOT NULL DEFAULT 'PENDING',
    retry_count      TINYINT        DEFAULT 0,
    next_retry_at    DATETIME,
    created_at       DATETIME       NOT NULL DEFAULT NOW(),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
    FOREIGN KEY (motion_event_id) REFERENCES motion_events(event_id),
    FOREIGN KEY (audio_event_id) REFERENCES audio_events(event_id)
  );
`;
