import { describe, expect, it } from 'vitest';

import type { AccessState } from '@/services';

import { decidePortalAccess, homeForRole, isStaffRole, safeNextPath } from './portal-access';

const signedOut: AccessState = {
  signedIn: false,
  userId: '',
  email: '',
  profile: null,
  aal: 'aal1',
  hasVerifiedFactor: false,
};

const tutor: AccessState = {
  signedIn: true,
  userId: 'tutor-id',
  email: 'tutor@example.com',
  profile: { fullName: 'Tutor', role: 'tutor' },
  aal: 'aal1',
  hasVerifiedFactor: false,
};

const adminWithoutTwoStep: AccessState = {
  ...tutor,
  profile: { fullName: 'Admin', role: 'admin' },
};
const adminNeedsCode: AccessState = { ...adminWithoutTwoStep, hasVerifiedFactor: true };
const adminFull: AccessState = { ...adminNeedsCode, aal: 'aal2' };
const deactivated: AccessState = { ...tutor, profile: null };
const student: AccessState = { ...tutor, profile: { fullName: 'Student', role: 'student' } };
const parent: AccessState = { ...tutor, profile: { fullName: 'Parent', role: 'parent' } };

describe('decidePortalAccess (design §11.3)', () => {
  it('1. sends signed-out people to sign in, remembering where they were going', () => {
    expect(decidePortalAccess(signedOut, 'admin', '/portal/admin')).toEqual({
      kind: 'redirect',
      to: '/portal/login?next=%2Fportal%2Fadmin',
    });
    expect(decidePortalAccess(signedOut, 'signedOutOnly', '/portal/login')).toEqual({
      kind: 'allow',
    });
  });

  it('2. signs out someone whose profile is unreadable (deactivated)', () => {
    expect(decidePortalAccess(deactivated, 'staff', '/portal/tutor')).toEqual({
      kind: 'signOut',
      to: '/portal/login?reason=inactive',
    });
  });

  it('3. asks for the authenticator code when two-step is set up but not done', () => {
    expect(decidePortalAccess(adminNeedsCode, 'admin', '/portal/admin')).toEqual({
      kind: 'redirect',
      to: '/portal/login/verify?next=%2Fportal%2Fadmin',
    });
    expect(decidePortalAccess(adminNeedsCode, 'twoStepVerify', '/portal/login/verify')).toEqual({
      kind: 'allow',
    });
  });

  it('4. makes an admin without an authenticator set one up first', () => {
    expect(decidePortalAccess(adminWithoutTwoStep, 'staff', '/portal/tutor')).toEqual({
      kind: 'redirect',
      to: '/portal/account/two-step/setup?next=%2Fportal%2Ftutor',
    });
    expect(
      decidePortalAccess(adminWithoutTwoStep, 'twoStepSetup', '/portal/account/two-step/setup'),
    ).toEqual({ kind: 'allow' });
  });

  it('5. shows "no access" when a tutor opens an admin page', () => {
    expect(decidePortalAccess(tutor, 'admin', '/portal/admin')).toEqual({ kind: 'forbidden' });
  });

  it('6. skips the sign-in page for someone already signed in', () => {
    expect(decidePortalAccess(tutor, 'signedOutOnly', '/portal/login')).toEqual({
      kind: 'redirect',
      to: '/portal/tutor',
    });
    expect(decidePortalAccess(adminFull, 'signedOutOnly', '/portal/login')).toEqual({
      kind: 'redirect',
      to: '/portal/admin',
    });
  });

  it('7. lets set-password through for anyone with a session (the page asks for a code if needed)', () => {
    expect(decidePortalAccess(adminNeedsCode, 'setPassword', '/portal/set-password')).toEqual({
      kind: 'allow',
    });
    expect(decidePortalAccess(signedOut, 'setPassword', '/portal/set-password')).toEqual({
      kind: 'redirect',
      to: '/portal/login',
    });
  });

  it('8. allows the right people in', () => {
    expect(decidePortalAccess(tutor, 'staff', '/portal/tutor')).toEqual({ kind: 'allow' });
    expect(decidePortalAccess(adminFull, 'staff', '/portal/tutor')).toEqual({ kind: 'allow' });
    expect(decidePortalAccess(adminFull, 'admin', '/portal/admin')).toEqual({ kind: 'allow' });
  });

  it('keeps tutors out of two-step setup, and sends finished admins home from the code step', () => {
    expect(decidePortalAccess(tutor, 'twoStepSetup', '/portal/account/two-step/setup')).toEqual({
      kind: 'redirect',
      to: '/portal/tutor',
    });
    expect(decidePortalAccess(adminFull, 'twoStepVerify', '/portal/login/verify')).toEqual({
      kind: 'redirect',
      to: '/portal/admin',
    });
  });
});

describe('decidePortalAccess for students and parents (R3b design §6.1)', () => {
  it('sends signed-out people to sign in from family pages too', () => {
    expect(decidePortalAccess(signedOut, 'student', '/portal/student')).toEqual({
      kind: 'redirect',
      to: '/portal/login?next=%2Fportal%2Fstudent',
    });
    expect(decidePortalAccess(signedOut, 'member', '/portal/account')).toEqual({
      kind: 'redirect',
      to: '/portal/login?next=%2Fportal%2Faccount',
    });
  });

  it('lets each family role into its own pages and shared pages', () => {
    expect(decidePortalAccess(student, 'student', '/portal/student')).toEqual({ kind: 'allow' });
    expect(decidePortalAccess(parent, 'parent', '/portal/parent')).toEqual({ kind: 'allow' });
    expect(decidePortalAccess(student, 'member', '/portal/account')).toEqual({ kind: 'allow' });
    expect(decidePortalAccess(parent, 'member', '/portal/account')).toEqual({ kind: 'allow' });
  });

  it("keeps families out of staff pages and out of each other's pages (F2)", () => {
    expect(decidePortalAccess(student, 'staff', '/portal/classes')).toEqual({ kind: 'forbidden' });
    expect(decidePortalAccess(parent, 'admin', '/portal/admin')).toEqual({ kind: 'forbidden' });
    expect(decidePortalAccess(student, 'parent', '/portal/parent')).toEqual({ kind: 'forbidden' });
    expect(decidePortalAccess(parent, 'student', '/portal/student')).toEqual({ kind: 'forbidden' });
  });

  it('keeps staff out of family pages', () => {
    expect(decidePortalAccess(tutor, 'student', '/portal/student')).toEqual({ kind: 'forbidden' });
    expect(decidePortalAccess(adminFull, 'parent', '/portal/parent')).toEqual({
      kind: 'forbidden',
    });
  });

  it('sends families home from the sign-in page and keeps them out of two-step setup', () => {
    expect(decidePortalAccess(student, 'signedOutOnly', '/portal/login')).toEqual({
      kind: 'redirect',
      to: '/portal/student',
    });
    expect(decidePortalAccess(parent, 'twoStepSetup', '/portal/account/two-step/setup')).toEqual({
      kind: 'redirect',
      to: '/portal/parent',
    });
  });
});

describe('homeForRole and isStaffRole', () => {
  it.each([
    ['tutor', '/portal/tutor', true],
    ['admin', '/portal/admin', true],
    ['student', '/portal/student', false],
    ['parent', '/portal/parent', false],
  ] as const)('%s → %s', (role, home, staff) => {
    expect(homeForRole(role)).toBe(home);
    expect(isStaffRole(role)).toBe(staff);
  });
});

describe('safeNextPath (design §11.3, G7)', () => {
  it.each([
    ['/portal/admin', '/portal/admin'],
    ['/portal', '/portal'],
    ['/portal/account?tab=security', '/portal/account?tab=security'],
  ])('accepts %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [''],
    ['https://evil.example/portal'],
    ['//evil.example/portal'],
    ['/\\evil.example'],
    ['/portal/../privacy'],
    ['/privacy'],
    ['/portalx'],
    ['javascript:alert(1)'],
  ])('rejects %s', (input) => {
    expect(safeNextPath(input)).toBeNull();
  });
});
