import { driversSchema } from './drivers';
import { tripsSchema } from './trips';
import { driverGoalsSchema } from './driver_goals';
import { motionEventsSchema } from './motion_events';
import { audioEventsSchema } from './audio_events';
import { flagEventsSchema } from './flag_events';
import { earningsVelocityLogSchema } from './earnings_velocity_log';
import { tripSummariesSchema } from './trip_summaries';

export const schemas = [
    { name: 'drivers', query: driversSchema },
    { name: 'trips', query: tripsSchema },
    { name: 'driver_goals', query: driverGoalsSchema },
    { name: 'motion_events', query: motionEventsSchema },
    { name: 'audio_events', query: audioEventsSchema },
    { name: 'flag_events', query: flagEventsSchema },
    { name: 'earnings_velocity_log', query: earningsVelocityLogSchema },
    { name: 'trip_summaries', query: tripSummariesSchema }
];
