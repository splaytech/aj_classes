// Week view of timetable slots (R3a story TS1, AS5; R3b FS5). Seven columns on wide screens;
// day tabs on phones, opening on today (review H23). For staff each slot links to its class.

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';

import {
  DAY_NAMES,
  DAYS_OF_WEEK,
  DELIVERY_WITH_LOCATION,
  TIMETABLE_PAGE,
  classPath,
} from '@/constants';
import { deliveryLabel, subjectLabel } from '@/lib/labels';
import { formatTimeRange, sessionsByDay } from '@/lib/timetable';
import type { DayOfWeek, TimetableEntry } from '@/services';

type WeekTimetableProps = {
  entries: TimetableEntry[];
  today: DayOfWeek;
  showTutor: boolean;
  /** Staff open the class page from a slot; students and parents can't (R3b). */
  linkToClass?: boolean;
};

type SlotOptions = Pick<WeekTimetableProps, 'showTutor' | 'linkToClass'>;

export function WeekTimetable({
  entries,
  today,
  showTutor,
  linkToClass = true,
}: WeekTimetableProps) {
  const options = { showTutor, linkToClass };
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const [shownDay, setShownDay] = useState<DayOfWeek>(today);
  const days = sessionsByDay(entries);

  if (isNarrow) {
    return (
      <Box>
        <Tabs
          value={shownDay}
          onChange={(_, day: DayOfWeek) => setShownDay(day)}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={TIMETABLE_PAGE.daysLabel}
          sx={{ mb: 3 }}
        >
          {DAYS_OF_WEEK.map((day) => (
            <Tab key={day} value={day} label={DAY_NAMES.short[day]} />
          ))}
        </Tabs>
        <DayColumn entries={days[shownDay]} {...options} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
      {DAYS_OF_WEEK.map((day) => (
        <Box key={day} component="section" aria-label={DAY_NAMES.long[day]}>
          <Typography
            variant="subtitle2"
            component="h2"
            sx={{
              mb: 2,
              pb: 1,
              borderBottom: 2,
              borderColor: day === today ? 'primary.main' : 'divider',
              color: day === today ? 'primary.main' : 'text.primary',
              fontWeight: 700,
            }}
          >
            {day === today
              ? TIMETABLE_PAGE.todayHeading(DAY_NAMES.short[day])
              : DAY_NAMES.short[day]}
          </Typography>
          <DayColumn entries={days[day]} {...options} />
        </Box>
      ))}
    </Box>
  );
}

function DayColumn({ entries, ...options }: SlotOptions & { entries: TimetableEntry[] }) {
  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {TIMETABLE_PAGE.noClasses}
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {entries.map((entry) => (
        <SessionCard key={entry.id} entry={entry} {...options} />
      ))}
    </Stack>
  );
}

function SessionCard({ entry, showTutor, linkToClass }: SlotOptions & { entry: TimetableEntry }) {
  const where = entry.location
    ? DELIVERY_WITH_LOCATION(deliveryLabel(entry.delivery), entry.location)
    : deliveryLabel(entry.delivery);

  const details = (
    <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {formatTimeRange(entry.startTime, entry.endTime)}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {entry.className}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        {subjectLabel(entry.subject)}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        {where}
      </Typography>
      {showTutor && entry.tutorName && (
        <Typography variant="caption" color="text.secondary" component="p">
          {entry.tutorName}
        </Typography>
      )}
    </CardContent>
  );

  return (
    <Card variant="outlined" sx={{ borderLeft: 4, borderLeftColor: 'primary.main' }}>
      {linkToClass ? (
        <CardActionArea component={RouterLink} to={classPath(entry.classId)}>
          {details}
        </CardActionArea>
      ) : (
        details
      )}
    </Card>
  );
}
