export const earningsVelocityLogSchema = `
  CREATE TABLE IF NOT EXISTS earnings_velocity_log (
    log_id               VARCHAR(10)    PRIMARY KEY,
    driver_id            VARCHAR(10)    NOT NULL,
    goal_id              VARCHAR(10)    NOT NULL,
    trip_id              VARCHAR(10)    NOT NULL,
    timestamp            DATETIME       NOT NULL,
    cumulative_earnings  DECIMAL(10,2)  NOT NULL,
    elapsed_hours        DECIMAL(5,2)   NOT NULL,
    current_velocity     DECIMAL(8,2)   NOT NULL,
    target_velocity      DECIMAL(8,2)   NOT NULL,
    velocity_delta       DECIMAL(8,2)   NOT NULL,
    trips_completed      SMALLINT       NOT NULL,
    forecast_status      ENUM('ahead','on_track','at_risk','behind')  NOT NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
    FOREIGN KEY (goal_id) REFERENCES driver_goals(goal_id),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
  );
`;
