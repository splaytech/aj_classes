// Every URL on the site and the file that renders it.

import { index, layout, route } from '@react-router/dev/routes';
import type { RouteConfig } from '@react-router/dev/routes';

import { PORTAL_ROUTE_PATTERNS, PORTAL_ROUTES, ROUTES } from './constants/routes.constants';

const PROGRAMME_PAGE = `${ROUTES.programmes}/:slug`;
const GUIDE_PAGE = `${ROUTES.resources}/:slug`;

export default [
  index('routes/home.tsx'),
  route(ROUTES.privacy, 'routes/privacy.tsx'),
  route(ROUTES.vce, 'routes/vce.tsx'), // a fixed path wins over the :slug pattern below
  route(PROGRAMME_PAGE, 'routes/programme.tsx'),
  route(ROUTES.resources, 'routes/resources.tsx'),
  route(GUIDE_PAGE, 'routes/resource.tsx'),
  route(ROUTES.subscribed, 'routes/subscribed.tsx'),
  route(ROUTES.posts, 'routes/posts.tsx'), // pre-rendered shell; posts load live in the browser (ADR-0001)
  route(ROUTES.sitemap, 'routes/sitemap.ts'),
  route(ROUTES.robots, 'routes/robots.ts'),

  // Portal (R2a staff, R3b students and parents): client-only pages, never pre-rendered
  // (R2a design §11.1–11.2).
  layout('routes/portal/portal-root.tsx', [
    route(PORTAL_ROUTES.login, 'routes/portal/login.tsx'),
    route(PORTAL_ROUTES.loginVerify, 'routes/portal/login-verify.tsx'),
    route(PORTAL_ROUTES.forgotPassword, 'routes/portal/forgot-password.tsx'),
    route(PORTAL_ROUTES.authConfirm, 'routes/portal/auth-confirm.tsx'),
    route(PORTAL_ROUTES.setPassword, 'routes/portal/set-password.tsx'),
    route(PORTAL_ROUTES.join, 'routes/portal/join.tsx'),
    route(PORTAL_ROUTES.twoStepSetup, 'routes/portal/two-step-setup.tsx'),

    // Signed-in pages, inside the portal header and the navigation for the person's role
    layout('routes/portal/member-layout.tsx', [
      route(PORTAL_ROUTES.root, 'routes/portal/home.tsx'),
      route(PORTAL_ROUTES.account, 'routes/portal/account.tsx'),

      layout('routes/portal/staff-layout.tsx', [
        route(PORTAL_ROUTES.tutor, 'routes/portal/tutor-dashboard.tsx'),
        route(PORTAL_ROUTES.timetable, 'routes/portal/timetable.tsx'),
        route(PORTAL_ROUTES.classes, 'routes/portal/classes.tsx'),
        route(PORTAL_ROUTE_PATTERNS.classDetail, 'routes/portal/class-detail.tsx'),
        route(PORTAL_ROUTES.assignments, 'routes/portal/assignments.tsx'),
        route(PORTAL_ROUTE_PATTERNS.assignmentDetail, 'routes/portal/assignment-detail.tsx'),
        route(PORTAL_ROUTE_PATTERNS.submission, 'routes/portal/submission.tsx'),
        route(PORTAL_ROUTES.profile, 'routes/portal/profile.tsx'),
        layout('routes/portal/admin-layout.tsx', [
          route(PORTAL_ROUTES.admin, 'routes/portal/admin-dashboard.tsx'),
          route(PORTAL_ROUTES.adminStaff, 'routes/portal/admin-staff.tsx'),
          route(PORTAL_ROUTE_PATTERNS.staffMember, 'routes/portal/admin-staff-member.tsx'),
          route(PORTAL_ROUTES.adminActivity, 'routes/portal/admin-activity.tsx'),
          route(PORTAL_ROUTES.adminEnquiries, 'routes/portal/admin-enquiries.tsx'),
          route(PORTAL_ROUTES.adminPosts, 'routes/portal/admin-posts.tsx'),
          route(PORTAL_ROUTES.adminStudents, 'routes/portal/admin-students.tsx'),
          route(PORTAL_ROUTE_PATTERNS.adminStudent, 'routes/portal/admin-student.tsx'),
        ]),
      ]),

      layout('routes/portal/student-layout.tsx', [
        route(PORTAL_ROUTES.student, 'routes/portal/student-home.tsx'),
        route(PORTAL_ROUTE_PATTERNS.studentAssignment, 'routes/portal/student-assignment.tsx'),
        route(PORTAL_ROUTES.studentTimetable, 'routes/portal/student-timetable.tsx'),
      ]),
      layout('routes/portal/parent-layout.tsx', [
        route(PORTAL_ROUTES.parent, 'routes/portal/parent-home.tsx'),
        route(PORTAL_ROUTE_PATTERNS.parentChild, 'routes/portal/parent-child.tsx'),
        route(
          PORTAL_ROUTE_PATTERNS.parentChildAssignment,
          'routes/portal/parent-child-assignment.tsx',
        ),
      ]),
    ]),

    route(`${PORTAL_ROUTES.root}/*`, 'routes/portal/not-found.tsx'),
  ]),

  route('*', 'routes/not-found.tsx'), // anything else → 404 page
] satisfies RouteConfig;
