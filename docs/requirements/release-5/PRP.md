# PRP — Release 5 (Month 5): Mobile App & Cross-Platform Engagement

> **Status:** Draft, not yet elaborated. Split from the [master PRP](../PRP.md).
> **Architecture:** [arch.md](../../architecture/arch.md)
> **Depends on:** Releases 1–4 (design tokens, auth, assignments, communities)

## Objective

Launch the Flutter mobile app to reach students on their phones, and drive engagement with native features and push notifications.

## Scope

### Mobile Parity (Flutter)
- iOS and Android apps using a shared Flutter theme **generated from the same design tokens JSON** as the web app.
- Mobile-optimised views for the Student Dashboard, assignment uploads (phone camera or files) and community browsing.

### Notification Engine
- Push notifications (mobile) and email alerts (web) for these triggers:
  - New assignment posted
  - Join request approved
  - Feedback returned
  - Due date approaching
- Preference centre where users turn individual notification types on or off.

## Architecture Mapping

| Concern | Component |
|---|---|
| Mobile build & store publishing | Codemagic, triggered by a `git tag` |
| Theme | Design tokens JSON transpiled to Flutter `ThemeData` |
| Backend | Same Supabase (Sydney) project and RLS as web |
| Email alerts | Resend |
| Push | To decide (FCM / APNs via Supabase Edge Functions) |
| Private video (if in scope) | Mux signed tokens from an Edge Function |

## To Elaborate
- Push provider choice and device-token storage
- Scheduler for "due date approaching" (pg_cron vs scheduled Edge Function)
- App Store / Play Store requirements for apps used by minors

> **Later:** The AI Tutor on recorded videos is planned for [Release 6](../release-6/PRP.md). Its mobile version will build on the Flutter app from this release.
