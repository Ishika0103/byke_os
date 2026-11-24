// Public entry point of the consumption feature. Import from '@/features/consumption'.
export { consumptionApi } from './api/consumption.api';
export { useConsumptionModules, useConsumptionSummary } from './hooks/use-consumption';
export { DayView } from './components/day-view';
export { ConsumptionHomeSection } from './components/home-section';
export { ModuleCalendar } from './components/module-calendar';
export { SyncPanel } from './components/sync-panel';
export { addDays, formatDay, toIsoDay, todayIso } from './dates';
