// A student's weekly classes (R3b story FS5): the same week view tutors use, without class links.

import Typography from '@mui/material/Typography';
import { useLoaderData } from 'react-router';

import { LoadError, PageHeader, WeekTimetable } from '@/components/portal';
import { PORTAL_ROUTES, PORTAL_SEO, SOLVE_PAGE, STUDENT_TIMETABLE_PAGE } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';
import { isoDayOfWeek } from '@/lib/timetable';
import { getMyTimetable } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.studentTimetable);
}

// Access (student) is checked by the student layout; the database returns only their classes.
export async function clientLoader() {
  return getMyTimetable();
}

export default function StudentTimetablePage() {
  const loaded = useLoaderData<typeof clientLoader>();
  if (!loaded.ok) return <LoadError error={loaded.error} />;

  return (
    <>
      <PageHeader
        title={STUDENT_TIMETABLE_PAGE.heading}
        intro={STUDENT_TIMETABLE_PAGE.intro}
        back={{ to: PORTAL_ROUTES.student, label: SOLVE_PAGE.back }}
      />
      {loaded.data.length === 0 ? (
        <Typography color="text.secondary">{STUDENT_TIMETABLE_PAGE.empty}</Typography>
      ) : (
        <WeekTimetable
          entries={loaded.data}
          today={isoDayOfWeek(new Date())}
          showTutor
          linkToClass={false}
        />
      )}
    </>
  );
}
