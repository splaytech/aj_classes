// The people an admin can choose as a class tutor: joined, active staff (admins included,
// e.g. Ajay teaches). Empty when the list can't be read (e.g. not an admin).

import { listStaff } from '@/services';

export type TutorOption = { id: string; name: string };

export async function activeStaffOptions(): Promise<TutorOption[]> {
  const staff = await listStaff();
  if (!staff.ok) return [];
  return staff.data
    .filter((member) => member.isActive && member.joinedAt)
    .map((member) => ({ id: member.id, name: member.fullName || member.email }));
}
