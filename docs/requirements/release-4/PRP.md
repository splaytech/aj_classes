# PRP — Release 4 (Month 4): Communities & Organization

> **Status:** Draft, not yet elaborated. Split from the [master PRP](../PRP.md).
> **Architecture:** [arch.md](../../architecture/arch.md)
> **Depends on:** [Release 3](../release-3/PRP.md) (students, assignments, submissions)

## Objective

Help tutors scale by grouping students into managed learning spaces, so they no longer have to assign work to each student one by one.

## Scope

### Community Creation
- Tutors create named communities with a description, cover image and subject tags.
- Tutors can promote enrolled students to **Community Admin**.

### Discovery & Enrollment
- Students browse a directory of public communities, or search by Victorian selective exam subject.
- "Request to Join" workflow.

### Approval & Management
- Pending-request queue where Tutors and Admins approve or reject enrollments.
- Member list management: remove members, demote admins.

### Workflow Migration
- Assignments are now created **inside** a community and go automatically to every approved member.

## Architecture Mapping

| Concern | Component |
|---|---|
| Communities | Postgres table (called `classes` in arch.md); RLS scopes `assignments` to enrolled members |
| Cover images | Supabase Storage (public bucket) |
| Membership / roles | Membership table with a per-community role (member / community_admin) |

## To Elaborate
- Settle naming: "community" (PRP) vs "class" (architecture)
- How existing R3 direct and global-roster assignments are migrated
- Private and invite-only community visibility rules
