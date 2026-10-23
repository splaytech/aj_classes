> **Superseded:** This is the original brief from 30 Sep 2026, kept for history. The live/current plan and decisions for each release are in `docs/requirements/release-<n>/PRP.md` — see [release-1/PRP.md](release-1/PRP.md) and [release-2/PRP.md](release-2/PRP.md).

## Release 1 (Month 1): The Public Face & Lead Generation

**Objective:** Establish brand presence, validate the market, and begin capturing prospective student and parent interest through a modern, high-converting web presence.

* **Public Landing Page (React Web):**
* Implementation of a configurable design system utilizing CSS variables/design tokens. This allows the core theme (primary colors, secondary accents, typography) to be easily swapped once final branding is decided.
* Hero section with primary value proposition and call-to-action (currently routing to the Contact form or a "Notify Me" waitlist).


* **Informational Pages:**
* About Us section detailing the AJ Classes methodology and tutor expertise.
* Testimonials section featuring the embedded video player and a grid of top written reviews.


* **Contact & Lead Capture:**
* Functional Contact Us form capturing Name, Email, Subject, and Message.
* Integration with a basic backend (e.g., email routing or a simple database table) to collect inquiries.


* **Infrastructure:**
* Web hosting setup, CI/CD pipeline, and domain configuration.



## Release 2 (Month 2): Tutor & Admin Foundations

**Objective:** Build the secure backend architecture and allow educators to access the platform, set up their profiles, and familiarize themselves with the administrative interface.

* **Authentication & Authorization:**
* Implementation of the secure login/sign-up flow (Email/Password + JWT or Firebase Auth).
* Role-Based Access Control (RBAC) foundation, specifically unlocking the 'Tutor' and 'Admin' roles.


* **Tutor Dashboard Shell:**
* Private, authenticated routing for the web app inheriting the configurable theme settings.
* Tutor profile management (name, subjects taught, avatar upload).


* **System Architecture:**
* Database provisioning (Users table, Roles).
* Secure session management and password reset workflows.



## Release 3 (Month 3): The Core Learning Loop

**Objective:** Onboard students and establish the primary value driver of the application—assigning work, submitting files, and providing feedback. *Note: Assignments in this phase are allocated directly to individual students or a global roster, acting as a stepping stone before the introduction of complex community structures.*

* **Student Access:**
* Student registration and login workflows.
* Student Dashboard UI highlighting upcoming tasks and recent scores, keeping styling strictly mapped to the global design tokens.


* **Assignment Allocation:**
* Tutors can create assignments (Title, description, due date, file attachments).
* Assignments populate on the designated students' dashboards.


* **Submission & Storage:**
* Students can upload multiple files (PDF, JPG, DOCX) as assignment submissions.
* Integration with Cloud Storage (e.g., AWS S3 or Firebase Storage) for secure file handling.


* **Marking & Visibility:**
* Tutors can view a list of submissions, input a score, and write text feedback.
* Status toggles (Submitted → Marked → Returned) instantly updating the student's dashboard view.



## Release 4 (Month 4): Communities & Organization

**Objective:** Introduce scalability for tutors by grouping students into managed learning environments, reducing the friction of individual assignment allocation.

* **Community Creation:**
* Tutors can create named communities with descriptions, cover images, and subject tags.
* Ability to promote existing enrolled students to 'Community Admin' status.


* **Discovery & Enrollment:**
* Students can browse a directory of public communities or search by specific Victorian selective exam subjects.
* Implementation of the "Request to Join" workflow.


* **Approval & Management:**
* Pending request queue for Tutors and Admins to Approve/Reject enrollments.
* Members list management (remove members, demote admins).


* **Workflow Migration:**
* Assignments are now generated *inside* a specific community, automatically distributing to all approved members.



## Release 5 (Month 5): Mobile App & Cross-Platform Engagement

**Objective:** Launch the Flutter mobile application to meet students where they are, driving engagement through native functionality and push notifications.

* **Mobile Parity (Flutter):**
* Release iOS and Android applications utilizing a shared Flutter theme that maps to the same configurable brand colors decided for the web.
* Mobile-optimized views for the Student Dashboard, Assignment uploads (via phone camera/files), and Community browsing.


* **Notification Engine:**
* Push notifications (mobile) and email alerts (web) for critical triggers: New assignment posted, Join request approved, Feedback returned, and Due date approaching.
* User preference center to toggle specific notification types on or off.



When the final color palette and branding guidelines are locked in, they can simply be injected into the global theme file without requiring structural frontend refactoring. Should we document the specific design tokens (e.g., `primary-color`, `secondary-button-bg`, `text-emphasis`) that need to be centralized for this approach?