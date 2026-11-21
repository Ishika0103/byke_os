import { AppError } from './app-error';

/**
 * Airport-style code from a name: initials of the main words ("Old Anchor Beach" → "OAB"),
 * or for a single word its first letter + consonants ("Brightland" → "BRG", "Deluxe" → "DLX").
 * `filler` words are skipped unless nothing else is left.
 */
export function codeFromName(name: string, filler: ReadonlySet<string> = new Set()): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const main = words.filter((w) => !filler.has(w));
  const use = main.length > 0 ? main : words;
  if (use.length >= 2) {
    return use
      .slice(0, 3)
      .map((w) => w[0])
      .join('');
  }

  const word = use[0] ?? '';
  const consonants = word.slice(1).replace(/[AEIOU]/g, '');
  const code = (word[0] ?? '') + consonants.slice(0, 2);
  return code.length >= 2 ? code : (word + 'XX').slice(0, 3);
}

/** `base`, or with 2, 3… added until `isTaken` says it's free ("TST", "TST2"). */
export async function firstFreeCode(
  base: string,
  isTaken: (code: string) => Promise<unknown>,
): Promise<string> {
  for (let n = 1; n < 100; n++) {
    const code = n === 1 ? base : `${base}${n}`;
    if (!(await isTaken(code))) return code;
  }
  throw AppError.conflict('CODE_TAKEN', 'Could not generate a free code');
}
