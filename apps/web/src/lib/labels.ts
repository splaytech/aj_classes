// Display labels for stored keys (subjects, year levels, delivery) and names.

import { DELIVERY_LABELS, SUBJECTS, YEAR_LEVEL_TEXT } from '@/constants';
import type { Delivery } from '@/services';

/** "Maths" for "maths"; an unknown key (e.g. removed from the list) is shown as stored. */
export function subjectLabel(key: string): string {
  return SUBJECTS.find((subject) => subject.key === key)?.label ?? key;
}

/** A student's year: "Year 8", or "Other (e.g. UCAT, GAMSAT)" when not at school. */
export function studentYearLabel(year: number | null): string {
  return year === null ? YEAR_LEVEL_TEXT.other : YEAR_LEVEL_TEXT.label(year);
}

/** A class's years, e.g. "Years 7–9, 11"; "Any year" when none are set (AC 13). */
export function classYearLabel(years: readonly number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const [onlyYear] = sorted;
  if (onlyYear === undefined) return YEAR_LEVEL_TEXT.any;
  if (sorted.length === 1) return YEAR_LEVEL_TEXT.label(onlyYear);
  return YEAR_LEVEL_TEXT.several(
    groupRuns(sorted).map(formatRun).join(YEAR_LEVEL_TEXT.listSeparator),
  );
}

/** Splits ascending years into runs of consecutive years: [7, 8, 9, 11] → [[7, 8, 9], [11]]. */
function groupRuns(sortedYears: readonly number[]): number[][] {
  const runs: number[][] = [];
  for (const year of sortedYears) {
    const currentRun = runs.at(-1);
    if (currentRun && currentRun.at(-1) === year - 1) currentRun.push(year);
    else runs.push([year]);
  }
  return runs;
}

/** "7–9" for a run of three or more; two next-door years stay a list, "7, 8" (AC 13). */
function formatRun(run: readonly number[]): string {
  if (run.length >= 3) return `${run[0]}${YEAR_LEVEL_TEXT.rangeSeparator}${run.at(-1)}`;
  return run.join(YEAR_LEVEL_TEXT.listSeparator);
}

export function deliveryLabel(delivery: Delivery): string {
  return DELIVERY_LABELS[delivery];
}

/** "Aarav" from "Aarav Demo", for greetings. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}
