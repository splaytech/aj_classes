Here is the final, consolidated architecture blueprint for AJ Classes. This diagram visualizes exactly how your web app, mobile app, and backend services connect, while maintaining the "no extra dashboards" rule for your daily development workflow.

This architecture optimizes for solo developer velocity by automating all infrastructure, code signing, and scaling operations.

### Architecture Breakdown & Workflow

This diagram separates the development cycle from the production runtime environments.

**1. The Solo Development Cycle (Top Layer)**
This is where you live day-to-day.

* **Workflow:** You write code locally (VS Code) and sync to **GitHub**. Your single source of truth for the entire visual design (`Design Tokens (JSON)`) is stored here and transpiled during build time for both web and mobile clients.
* **Trigger:** The only action you take is a single `git push` or `git tag`.

**2. The Automated CI/CD Pipelines (Build Layer)**
The moment you push code, specialized platforms take over, ensuring you don't have to manage servers or build hardware.

* **Web Deployment (Vercel):** Every push to `main` triggers Vercel. It fetches the code, compiles the React/Vite app using edge optimization, and updates the public website in seconds.
* **Mobile Deployment (Codemagic):** A push with a new version tag (e.g., `v1.1`) triggers Codemagic. It provisions specialized hardware (including macOS for iOS builds), fetches your code, performs automatic code signing using stored API keys, and pushes the new binaries directly to the **App Store Connect** and **Google Play Console** portals.

**3. The Production Ecosystem (Runtime Layer)**
This is what your students and tutors interact with.

* **The Hub (Supabase Sydney):** Both the React Web App and the Flutter Mobile App connect primarily to Supabase in Sydney via optimized APIs. The client identity is established via **Auth (GoTrue)**. The database enforces **Row Level Security (RLS)**, ensuring a student can only access the `assignments` table for the `classes` they are enrolled in, while tutors have broader access.
* **Secure Video (Mux):** If the database indicates a private tutoring video (gated content), the **Supabase Edge Function** issues a short-lived, signed token. This token is passed to the client (Web or Flutter), which uses it to stream the private video securely from Mux.
* **Testimonial Video (YouTube Unlisted):** If the content is public marketing ( testimonials), the clients simply pull the YouTube ID from the database and render it in a public player component.
* **Email Communication (Resend):** Any auth event (password reset, sign-up confirmation) is handled via **Resend**, ensuring high deliverability without you managing email servers.

This architecture is bulletproof, standard, and highly resilient for a solo developer. By consolidating all stateful data and secure logic inside Supabase (Sydney) and offloading specialized marketing (YouTube), private video (Mux), and mobile builds (Codemagic), you get all the benefits of best-in-class platforms without the overhead of daily maintenance.

## Diagram

```mermaid
flowchart TD
    %% Styling
    classDef dev fill:#2563eb,stroke:#1e40af,color:#fff;
    classDef cicd fill:#ea580c,stroke:#c2410c,color:#fff;
    classDef client fill:#059669,stroke:#047857,color:#fff;
    classDef backend fill:#16a34a,stroke:#15803d,color:#fff;
    classDef external fill:#7c3aed,stroke:#6d28d9,color:#fff;

    %% Development Layer
    subgraph DevLayer [1. Development Layer]
        A[VS Code / Local Dev]:::dev -->|Commit & Push| B[GitHub Repository]:::dev
        C[Design Tokens JSON]:::dev -.->|Single Source of Truth| B
    end

    %% CI/CD Layer
    subgraph CICDLayer [2. CI/CD Layer]
        B -->|git push main| D[Cloudflare Pages / Vercel]:::cicd
        B -->|git tag release| E[Codemagic]:::cicd
    end

    %% Runtime Clients
    subgraph ClientLayer [3. Runtime Clients]
        D -->|Hosts| F[React/Vite Web App]:::client
        E -->|Compiles & Publishes| G[Flutter Mobile App]:::client
    end

    %% Managed Backend
    subgraph BackendLayer [4. Supabase Backend - Sydney]
        F <-->|API| H(Supabase Edge):::backend
        G <-->|API| H
        H <--> I[(PostgreSQL Database)]:::backend
        H <--> J[Auth & RLS]:::backend
        H <--> K[Storage Buckets]:::backend
    end

    %% External Services
    subgraph ExternalLayer [5. External Services]
        J -->|Triggers Auth Emails| L[Resend SMTP]:::external
        F -->|Renders Public ID| M[YouTube Unlisted]:::external
        G -->|Renders Public ID| M
        H -->|Generates Secure Token| N[Mux Video API]:::external
        F -.->|Streams Private Video| N
        G -.->|Streams Private Video| N
    end
```