// Every URL on the site and the file that renders it.

import { index, layout, route } from '@react-router/dev/routes';
import type { RouteConfig } from '@react-router/dev/routes';

import { PORTAL_ROUTE_PATTERNS, PORTAL_ROUTES, ROUTES } from './constants/routes.constants';

export default [
  index('routes/home.tsx'),
  route(ROUTES.privacy, 'routes/privacy.tsx'),
  route(ROUTES.sitemap, 'routes/sitemap.ts'),
  route(ROUTES.robots, 'routes/robots.ts'),

  // Staff portal (R2a): client-only pages, never pre-rendered (design §11.1–11.2).
  layout('routes/portal/portal-root.tsx', [
    route(PORTAL_ROUTES.login, 'routes/portal/login.tsx'),
    route(PORTAL_ROUTES.loginVerify, 'routes/portal/login-verify.tsx'),
    route(PORTAL_ROUTES.forgotPassword, 'routes/portal/forgot-password.tsx'),
    route(PORTAL_ROUTES.authConfirm, 'routes/portal/auth-confirm.tsx'),
    route(PORTAL_ROUTES.setPassword, 'routes/portal/set-password.tsx'),
    route(PORTAL_ROUTES.twoStepSetup, 'routes/portal/two-step-setup.tsx'),

    // Signed-in pages, inside the staff header and navigation
    layout('routes/portal/staff-layout.tsx', [
      route(PORTAL_ROUTES.root, 'routes/portal/home.tsx'),
      route(PORTAL_ROUTES.tutor, 'routes/portal/tutor-dashboard.tsx'),
      route(PORTAL_ROUTES.timetable, 'routes/portal/timetable.tsx'),
      route(PORTAL_ROUTES.classes, 'routes/portal/classes.tsx'),
      route(PORTAL_ROUTE_PATTERNS.classDetail, 'routes/portal/class-detail.tsx'),
      route(PORTAL_ROUTES.assignments, 'routes/portal/assignments.tsx'),
      route(PORTAL_ROUTE_PATTERNS.assignmentDetail, 'routes/portal/assignment-detail.tsx'),
      route(PORTAL_ROUTES.profile, 'routes/portal/profile.tsx'),
      route(PORTAL_ROUTES.account, 'routes/portal/account.tsx'),
      layout('routes/portal/admin-layout.tsx', [
        route(PORTAL_ROUTES.admin, 'routes/portal/admin-dashboard.tsx'),
        route(PORTAL_ROUTES.adminStaff, 'routes/portal/admin-staff.tsx'),
        route(PORTAL_ROUTE_PATTERNS.staffMember, 'routes/portal/admin-staff-member.tsx'),
        route(PORTAL_ROUTES.adminActivity, 'routes/portal/admin-activity.tsx'),
        route(PORTAL_ROUTES.adminStudents, 'routes/portal/admin-students.tsx'),
      ]),
    ]),

    route(`${PORTAL_ROUTES.root}/*`, 'routes/portal/not-found.tsx'),
  ]),

  route('*', 'routes/not-found.tsx'), // anything else → 404 page
] satisfies RouteConfig;
