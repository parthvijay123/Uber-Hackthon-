export const tripsSchema = `
  CREATE TABLE IF NOT EXISTS trips (
    trip_id           VARCHAR(10)    PRIMARY KEY,
    driver_id         VARCHAR(10)    NOT NULL,
    date              DATE           NOT NULL,
    start_time        TIME           NOT NULL,
    end_time          TIME,
    duration_min      SMALLINT,
    distance_km       DECIMAL(6,2),
    fare              DECIMAL(8,2)   NOT NULL,
    surge_multiplier  DECIMAL(4,2)   DEFAULT 1.0,
    pickup_location   VARCHAR(100),
    dropoff_location  VARCHAR(100),
    trip_status       ENUM('completed','cancelled','ongoing'),
    created_at        DATETIME       NOT NULL DEFAULT NOW(),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
  );
`;
