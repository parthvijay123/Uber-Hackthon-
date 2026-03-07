export enum MotionClass {
  normal = 'normal',
  moderate = 'moderate',
  harsh = 'harsh',
  collision = 'collision',
}

export interface AccelSample {
  sensor_id: string
  trip_id: string
  timestamp: string
  elapsed_s: number
  ax: number
  ay: number
  az: number
  speed_kmh: number
  gps_lat: number
  gps_lon: number
}

export interface BatchWindow {
  window_id: string
  trip_id: string
  t_start: number
  t_end: number
  samples: AccelSample[]
}

export interface WindowResult {
  window_id: string
  trip_id: string
  t_start: number
  t_end: number
  peak_magnitude: number
  delta_speed: number
  event_type: MotionClass
  score: number
  explanation: string
}

export interface MotionEvent {
  event_id: string
  trip_id: string
  timestamp: string
  elapsed_s: number
  event_type: MotionClass
  magnitude: number
  delta_speed: number
  score: number
  explanation: string
}
