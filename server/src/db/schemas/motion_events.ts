export const motionEventsSchema = `
  CREATE TABLE IF NOT EXISTS motion_events (
    event_id    VARCHAR(36)    PRIMARY KEY,
    trip_id     VARCHAR(10)    NOT NULL,
    driver_id   VARCHAR(10)    NOT NULL,
    timestamp   DATETIME       NOT NULL,
    elapsed_s   INT            NOT NULL,
    event_type  ENUM('normal','moderate_brake','harsh_braking','harsh_accel','collision')  NOT NULL,
    magnitude   DECIMAL(6,3)   NOT NULL,
    delta_speed DECIMAL(6,2)   NOT NULL,
    score       DECIMAL(4,3)   NOT NULL,
    explanation TEXT,
    created_at  DATETIME       NOT NULL DEFAULT NOW(),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
  );
`;
