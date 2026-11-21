import type { Option } from '@/components/ui/option-dialog';

/** "14:00" → "2:00 PM" */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Every 30 minutes of the day, for the check-in / check-out pickers. */
export const TIME_OPTIONS: Option[] = Array.from({ length: 48 }, (_, i) => {
  const value = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
  return { value, label: formatTime(value) };
});
