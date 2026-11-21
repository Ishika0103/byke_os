/** Text from a number field: '' → null, otherwise the number (NaN when it isn't one). */
export function numberOrNull(text: string): number | null {
  const t = text.trim();
  return t === '' ? null : Number(t);
}

/** Field error for number fields that don't hold a number, before Zod runs. */
export function notANumber(fields: Record<string, number | null>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(fields)) {
    if (value !== null && Number.isNaN(value)) errors[field] = 'Enter a number';
  }
  return errors;
}
