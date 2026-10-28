// Timetable (R3a stories TS1, AS5): the week at a glance. Tutors see their classes; admins see
// every active class and can filter by tutor.

import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useLoaderData } from 'react-router';

import { LoadError, PageHeader, WeekTimetable } from '@/components/portal';
import { PORTAL_SEO, TIMETABLE_PAGE } from '@/constants';
import { buildPortalMeta } from '@/lib/seo';
import { isoDayOfWeek } from '@/lib/timetable';
import { listTimetable } from '@/services';
import type { TimetableEntry } from '@/services';

import { useStaffAccess } from './staff-layout';

const ALL_TUTORS = 'all';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.timetable);
}

// Access is checked by the staff layout; the database returns only what this person may see.
export async function clientLoader() {
  return listTimetable();
}

/** Each tutor once, by name, for the admin filter. */
function tutorsIn(entries: TimetableEntry[]): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const entry of entries) {
    if (entry.tutorId) byId.set(entry.tutorId, entry.tutorName);
  }
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export default function TimetablePage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const access = useStaffAccess();
  const isAdmin = access.profile?.role === 'admin';
  const [tutorFilter, setTutorFilter] = useState(ALL_TUTORS);

  if (!loaded.ok) return <LoadError error={loaded.error} />;

  const entries =
    tutorFilter === ALL_TUTORS
      ? loaded.data
      : loaded.data.filter((entry) => entry.tutorId === tutorFilter);

  return (
    <>
      <PageHeader
        title={TIMETABLE_PAGE.heading}
        intro={isAdmin ? TIMETABLE_PAGE.introAdmin : TIMETABLE_PAGE.introTutor}
        actions={
          isAdmin && (
            <TextField
              select
              size="small"
              label={TIMETABLE_PAGE.tutorFilter}
              value={tutorFilter}
              onChange={(event) => setTutorFilter(event.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value={ALL_TUTORS}>{TIMETABLE_PAGE.allTutors}</MenuItem>
              {tutorsIn(loaded.data).map((tutor) => (
                <MenuItem key={tutor.id} value={tutor.id}>
                  {tutor.name}
                </MenuItem>
              ))}
            </TextField>
          )
        }
      />
      {loaded.data.length === 0 ? (
        <Typography color="textSecondary">{TIMETABLE_PAGE.empty}</Typography>
      ) : (
        <WeekTimetable entries={entries} today={isoDayOfWeek(new Date())} showTutor={isAdmin} />
      )}
    </>
  );
}
