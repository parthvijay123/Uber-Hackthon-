export const driverGoalsSchema = `
  CREATE TABLE IF NOT EXISTS driver_goals (
    goal_id          VARCHAR(10)    PRIMARY KEY,
    driver_id        VARCHAR(10)    NOT NULL,
    date             DATE           NOT NULL,
    shift_start_time TIME           NOT NULL,
    shift_end_time   TIME           NOT NULL,
    target_earnings  DECIMAL(10,2)  NOT NULL,
    target_hours     DECIMAL(5,2)   NOT NULL,
    created_at       DATETIME       NOT NULL DEFAULT NOW(),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
  );
`;
