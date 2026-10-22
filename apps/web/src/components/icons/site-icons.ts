// Which icon goes where (ui-polish.md §1). One outline set (Lucide) for the whole site.
// Icons are decoration: always render them with aria-hidden, next to text that says the same.

import {
  Award,
  BookOpenCheck,
  ClipboardCheck,
  Compass,
  FlaskConical,
  GraduationCap,
  MessageSquareText,
  MessagesSquare,
  PencilLine,
  Rocket,
  School,
  Stethoscope,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { PROGRAMME_SLUGS } from '@/constants';
import type { ApproachStepId, ProgrammeSlug, ResultId } from '@/constants';

export const PROGRAMME_ICONS: Record<ProgrammeSlug, LucideIcon> = {
  [PROGRAMME_SLUGS.selectiveEntry]: School,
  [PROGRAMME_SLUGS.interviews]: MessagesSquare,
  [PROGRAMME_SLUGS.sealAndScholarships]: Rocket,
  [PROGRAMME_SLUGS.naplan]: PencilLine,
  [PROGRAMME_SLUGS.icas]: Trophy,
  [PROGRAMME_SLUGS.mathsScienceEnglish]: BookOpenCheck,
  [PROGRAMME_SLUGS.vce]: GraduationCap,
  [PROGRAMME_SLUGS.vceSubjectSelection]: Compass,
  [PROGRAMME_SLUGS.ucatAndGamsat]: Stethoscope,
};

export const RESULT_ICONS: Record<ResultId, LucideIcon> = {
  selective: School,
  jmss: FlaskConical,
  scholarships: Award,
};

export const APPROACH_STEP_ICONS: Record<ApproachStepId, LucideIcon> = {
  assess: ClipboardCheck,
  plan: Target,
  practise: Timer,
  review: MessageSquareText,
};
