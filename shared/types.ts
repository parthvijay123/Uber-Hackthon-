export enum MotionClass {
  normal = 'normal',
  moderate = 'moderate',
  harsh = 'harsh',
  collision = 'collision',
}

export enum AudioClass {
  quiet = 'quiet',
  normal = 'normal',
  conversation = 'conversation',
  loud = 'loud',
  very_loud = 'very_loud',
  argument = 'argument',
}

export enum AudioSeverity {
  SHORT_LOW = 'SHORT_LOW',
  SHORT_MODERATE = 'SHORT_MODERATE',
  SHORT_HIGH = 'SHORT_HIGH',
  SHORT_CRITICAL = 'SHORT_CRITICAL',
  MODERATE_SPIKE = 'MODERATE_SPIKE',
  HIGH_SPIKE = 'HIGH_SPIKE',
  CRITICAL_SPIKE = 'CRITICAL_SPIKE',
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

export interface AudioSample {
  audio_id: string
  trip_id: string
  timestamp: string
  elapsed_s: number
  db_level: number
}

export interface AudioBatchWindow {
  window_id: string
  trip_id: string
  t_start: number
  t_end: number
  samples: AudioSample[]
}

export interface AudioEvent {
  event_id: string
  trip_id: string
  timestamp: string
  elapsed_s: number
  peak_db: number
  avg_db: number
  baseline_db: number
  magnitude_db: number
  duration_s: number
  audio_class: AudioClass
  severity: AudioSeverity
  is_sustained: boolean
  rate_of_change: number
}

// ─── Fusion types ───────────────────────────────────────────────────────────

export enum FlagType {
  conflict_moment = 'conflict_moment',
  audio_only = 'audio_only',
  motion_only = 'motion_only',
}

export enum FlagSeverity {
  low = 'low',
  medium = 'medium',
  high = 'high',
}

export interface FlagEvent {
  flag_id: string
  trip_id: string
  driver_id: string
  timestamp: string
  elapsed_s: number
  flag_type: FlagType
  severity: FlagSeverity
  motion_score: number
  audio_score: number
  combined_score: number
  explanation: string
  context: string
  motion_event_id: string | null
  audio_event_id: string | null
}

export interface TripAnalysisResult {
  trip_id: string
  motion_events: MotionEvent[]
  audio_events: AudioEvent[]
  flag_events: FlagEvent[]
  processed_at: string
  duration_ms: number
}

// Unified timeline discriminated union
export type TimelineEvent =
  | { source: 'motion'; data: MotionEvent }
  | { source: 'audio'; data: AudioEvent }
  | { source: 'flag'; data: FlagEvent }
