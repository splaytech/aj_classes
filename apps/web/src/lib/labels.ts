// Display labels for stored keys (subjects, year levels, delivery).

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

/** A class's year: "Year 8", or "Any year" when it isn't for one year level. */
export function classYearLabel(year: number | null): string {
  return year === null ? YEAR_LEVEL_TEXT.any : YEAR_LEVEL_TEXT.label(year);
}

export function deliveryLabel(delivery: Delivery): string {
  return DELIVERY_LABELS[delivery];
}
