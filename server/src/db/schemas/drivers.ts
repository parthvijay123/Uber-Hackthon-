export const driversSchema = `
  CREATE TABLE IF NOT EXISTS drivers (
    driver_id            VARCHAR(10)    PRIMARY KEY,
    name                 VARCHAR(100)   NOT NULL,
    city                 VARCHAR(50)    NOT NULL,
    shift_preference     ENUM('morning','evening','full_day')  NOT NULL,
    avg_hours_per_day    DECIMAL(4,1),
    avg_earnings_per_hr  DECIMAL(8,2),
    experience_months    SMALLINT,
    rating               DECIMAL(3,1),
    created_at           DATETIME       NOT NULL DEFAULT NOW()
  );
`;
