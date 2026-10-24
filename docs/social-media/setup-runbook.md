# AJ Classes: social media setup runbook

What was set up, in what order, with the exact values used, so any step can be repeated or checked. Written 22 October 2026. Companion to [launch-kit.md](launch-kit.md), which holds the full copy for every platform, the 9-post grid captions and hashtags, the posting plan and the [TBC] list.

**Never stored here:** passwords, OTPs, verification selfies or videos. Use a password manager. A password was typed into a chat early in the project, so treat it as exposed and rotate it.

---

## 1. Status at a glance

| Platform | Account / handle | State |
|---|---|---|
| Facebook Page | AJ Classes, `facebook.com/profile.php?id=61595519166933` | Live. Username (`@ajclasses`) not available yet. Messenger auto-replies pending. |
| YouTube | AJ Classes, `@ajclassesau`, `youtube.com/@ajclassesau` | Live. Phone verification done by owner. Trailer, playlists and watermark pending. |
| Google Business Profile | AJ Classes, Truganina VIC | Set up. **Verification video submitted 22 Oct 2026, awaiting Google.** Not publicly visible until approved. |
| Instagram | `@aj_classes_au` | Active after appeal. Profile picture and bio set. Business-account switch, link and posts pending. |
| WhatsApp Business | +61 469 800 685 | Set up by owner on the phone. Catalogue deliberately skipped. |
| LinkedIn, TikTok | Not created | Optional. Skip for now (see launch-kit section 6). |

---

## 2. Shared facts (single source of truth)

| Item | Value |
|---|---|
| Business name | AJ Classes |
| Tagline | Every student can rise. |
| Website | https://ajclasses.com.au |
| Contact form link (used on every "Register interest" button) | https://ajclasses.com.au/#contact |
| Email | hello@ajclasses.com.au |
| Phone / WhatsApp | +61 469 800 685 (entered as `0469 800 685` on Google, `469800685` with +61 on Facebook) |
| WhatsApp link | https://wa.me/61469800685 |
| Locations | In person: Williams Landing, Truganina, Craigieburn (VIC). Online: anywhere in Australia. |
| Format | Small groups, twice a week. Qualified teachers, 20+ years of combined teaching experience, each with a Working With Children Check. |
| Brand colours | Blue `#2563eb`, navy `#172554`, gold `#f9c62b` |
| Logo master | `apps/web/public/logo.svg` (gold rounded square, three upward pencils) |
| 2026 results (always labelled "2026 results") | 10 selective high school offers for Year 9 (Melbourne High School 4, Suzanne Cory High School 4); 5 John Monash Science School offers; 3 private school scholarships |
| Current call to action | Enrolling now for 2027: Register interest |

**Content rules followed everywhere:** no guaranteed or implied results, past results labelled 2026, no student names or photos, original wording, Australian English, `[TBC: …]` for any fact not supplied (and no placeholders left on public pages).

**Accounts:** Facebook, YouTube and Google Business Profile were created or signed in on the business email `hello@ajclasses.com.au`. The owner did all sign-ups, passwords, OTPs, phone/identity verification and the verification video. Nothing in this runbook was entered by automation for those.

---

## 3. Image assets (all in `brand/social/`)

| File | Size | Used on |
|---|---|---|
| `facebook-profile-800.png` / `.svg` | 800 × 800 | Facebook, Instagram profile picture; logo on navy, ~60% width |
| `facebook-cover-1640x624.png` / `.svg` | 1640 × 624 | Facebook cover (tagline, "2026 RESULTS" tag, 10 / 5 / 3 counts, text kept in centre ~1,100 px) |
| YouTube banner (generated in-browser) | 2048 × 1152 | Logo, tagline, "Small-group tutoring · Melbourne & online", "Enrolling now for 2027", inside the 1235 × 338 safe area |
| YouTube profile picture (generated in-browser) | 800 × 800 | Same as Facebook profile |
| `google-logo-720.png` / `.svg` | 720 × 720 | Google Business Profile logo |
| `google-cover-1080x608.png` / `.svg` | 1080 × 608 | Google Business Profile cover (marked "pending" by Google; Google may choose another photo) |
| `instagram/post1-…` to `post9-…` | 1080 × 1440 (24 files) | Grid posts and carousel slides; posts 1 and 7 are reel cover frames; post 8 omits the [TBC] teacher-bio slide |
| `instagram/highlights/*.png` | 1080 × 1920 (6 files) | programmes, 2026-results, teachers, how-it-works, ucat-gamsat, enrol-2027 |

Rendering method: SVG or HTML rendered by headless Google Chrome (`--headless=new --window-size=W,H --screenshot=…`). `qlmanage` and `sips` were tried first and gave wrong sizes.

---

## 4. Facebook Page

**URL:** `https://www.facebook.com/profile.php?id=61595519166933` (Page ID 61595519166933)

### 4.1 What was done, in order
1. Opened `facebook.com/pages/create` while signed in.
2. Filled the create form (copy-paste values below), then clicked **Create Page**.
3. Step 1 of 5 (contact details), then profile picture, cover and action button, then WhatsApp (skipped), audience (skipped), notifications.
4. The profile picture did not save in the setup form, so it was re-uploaded from the Page profile ("Add profile picture" → upload → description → Save).
5. Verified the action button under the Page's `…` menu → **Action button** (saved, showing the Sign up link).

### 4.2 Values entered
| Field | Value |
|---|---|
| Page name | `AJ Classes` |
| Category | Tutor/Teacher |
| Bio (Intro) | `Small-group tutoring in Melbourne and online. Every student can rise.` |
| Website | `https://ajclasses.com.au/#contact` (shows as `ajclasses.com.au` under Links) |
| Phone | Country code AU +61, number `469800685` |
| Email | `hello@ajclasses.com.au` |
| Address, town, postcode | Left blank ([TBC] venue addresses) |
| Hours | "No hours available" ([TBC]) |
| Profile picture description | `AJ Classes logo: a gold rounded square with three upward pencils` |
| Action button | **Sign up** → `https://ajclasses.com.au/#contact` |
| Marketing emails from Meta | Turned **off** |
| Page notifications on profile | Left **on** |
| WhatsApp connection | Skipped (connect after WhatsApp Business is live) |

### 4.3 Things learned
- The create form's category dropdown needs a moment to load. Pick "Tutor/Teacher".
- Typing into the wrong field is easy in the narrow browser pane. Check field values with a screenshot before saving.
- The country-code dropdown needs "Australia" typed into its own search box, not the website field.
- **No username option** appears for this new Page (not in About, Settings, or Page setup). Retry in a few days under the Page's About/Edit info.
- **Meta Business Suite** (`business.facebook.com/latest/…`) returned "content isn't available" for this Page in the automated browser. Open it yourself while signed in to set Messenger automations.
- The Sign up button is saved but is not visible when viewing the Page as an admin in the narrow layout; confirm via the Page's `…` menu.

### 4.4 Still pending
- [ ] Username `@ajclasses` (fallback `@ajclasses.au`, which Facebook treats as `ajclassesau`).
- [ ] Messenger instant reply (greeting), away message and five saved replies (text in section 9).
- [ ] 255-character About and long description (launch-kit section 1).
- [ ] WhatsApp link, address/service area, opening hours.
- [ ] Two-factor authentication and a second Page admin.
- [ ] Services list, pinned "Enrolling now for 2027" post, first posts.
- [ ] Check the cover on mobile (stat labels might clip).

---

## 5. YouTube channel

**URL:** `https://www.youtube.com/@ajclassesau` · Channel ID `UCwD8UYWLjiWBmGfQWd4KZQg` · Studio: `https://studio.youtube.com/channel/UCwD8UYWLjiWBmGfQWd4KZQg`

### 5.1 What was done
1. Signed in on the Google account for `hello@ajclasses.com.au`.
2. `youtube.com/create_channel` → "How you'll appear": name `AJ Classes`, handle changed from the suggested one.
3. Handle attempts: `@ajclasses` taken, `@ajclasses.au` taken, `@ajclassesmelbourne` available, **`@ajclassesau`** chosen (YouTube ignores full stops). Created the channel.
4. Studio → Customisation → Profile: banner, profile picture, description, link, contact email, **Publish**.
5. Studio → Settings → Channel: country, keywords, audience.
6. Owner completed `youtube.com/verify` (phone verification).

### 5.2 Values entered
| Field | Value |
|---|---|
| Channel name | `AJ Classes` |
| Handle | `@ajclassesau` |
| Link title (max 30) | `Register interest for 2027` |
| Link URL | `https://ajclasses.com.au/#contact` |
| Contact email | `hello@ajclasses.com.au` |
| Country of residence | Australia |
| Keywords | `AJ Classes, Melbourne tutoring, selective entry, NAPLAN, ICAS, VCE, UCAT, GAMSAT, Williams Landing, Truganina, Craigieburn` |
| Audience | "No, set this channel as not made for kids" |

**Description (979 of 1,000 characters):**
```text
Small-group tutoring in Melbourne and online. Every student can rise.

AJ Classes teaches in person in Williams Landing, Truganina and Craigieburn, and online anywhere in Australia. Our qualified teachers bring 20+ years of combined teaching experience, and each holds a Working With Children Check.

On this channel: study tips, programme overviews, and what to expect from selective entry, scholarship, NAPLAN, ICAS, VCE and UCAT/GAMSAT preparation. We won't show or name any student.

Programmes: selective entry exam preparation (Years 6–10), selective school and scholarship interview coaching (Years 8–10), SEAL and private school scholarship preparation, NAPLAN (Years 2–9), ICAS (Years 5–10), Maths, Science and English (Years 5–10), VCE (Years 11–12) and VCE subject-selection counselling. New: UCAT and GAMSAT preparation, classes starting January 2027.

Enrolling now for 2027: https://ajclasses.com.au/#contact
Email: hello@ajclasses.com.au
WhatsApp: +61 469 800 685
```

### 5.3 Things learned
- The handle field already contains "@", so type the name only. Typing quickly triggers autocomplete that corrupts the value; delete and retype slowly.
- Studio's customisation pane has hidden file inputs: input 1 = banner, input 2 = picture. After choosing a file a crop dialog opens and its **Done** button can be off-screen in a narrow pane. Click it via the page, then press **Publish**.
- The public channel page can show the default avatar for a few minutes after publishing. Studio shows the saved state.
- The settings pane is a dialog with Basic info and Advanced settings tabs. **Save** appears only after a change.

### 5.4 Still pending
- [ ] Trailer, playlists (Selective & Scholarship, NAPLAN & ICAS, VCE & beyond), video watermark.
- [ ] Re-check that the logo has replaced the grey "A" publicly.
- [ ] Decide if other platforms should match `ajclassesau`.

---

## 6. Google Business Profile

**Account:** Google account for `hello@ajclasses.com.au` · Manager: `business.google.com/locations` · Store code `03059024843466697269` · Location ID `15288113749669556167`
**Managing an unverified profile:** Google Search → "my business" shows the owner panel (Edit profile, Photos, Edit services, Q&A, Posts).

### 6.1 What was done
1. `business.google.com/create` → name **AJ Classes**, "Create a business with this name" (several unrelated "AJ Classes" listings in India appear; none are ours).
2. Category: typing into the category box did not show suggestions for automation; the owner picked **Tutor** (the picker's label) and entered the business address in the form.
3. Contact details: phone `0469 800 685`, website `https://ajclasses.com.au`, chat left blank. Alerts/updates: **Yes**.
4. Verification: "Is this your business?" listed other tutoring businesses (do not select any). Owner chose none, selected **video verification** and submitted the video on 22 Oct 2026.
5. In the owner panel: logo, cover, description and services were added (below).

### 6.2 Values entered
| Field | Value |
|---|---|
| Name | `AJ Classes` |
| Primary category | Tutor |
| Phone | `0469 800 685` |
| Website | `https://ajclasses.com.au` |
| Address on the profile | A street address in Truganina VIC 3029, entered by the owner. **Check before the profile goes public: if it is a home address, switch to service-area only and hide it.** |
| Logo | `google-logo-720.png` |
| Cover | `google-cover-1080x608.png` (status: pending Google review) |

**Business description (692 of 750):**
```text
AJ Classes is a small-group tutoring business with in-person classes in Williams Landing, Truganina and Craigieburn, and online classes for students anywhere in Australia. Groups meet twice a week and are taught by qualified teachers who bring 20+ years of combined teaching experience and each hold a Working With Children Check. Programmes include selective entry exam preparation, selective school and scholarship interview coaching, SEAL and private school scholarship preparation, NAPLAN and ICAS preparation, Maths, Science and English tutoring, VCE tutoring and subject-selection counselling, and UCAT and GAMSAT preparation, with classes starting January 2027. Every student can rise.
```

**Services (name limit 120, description limit 300, no prices):**

| Service | Description |
|---|---|
| Selective entry exam preparation (Years 6–10) | Small-group preparation for selective entry exams: reading, writing, maths, verbal and quantitative reasoning, and timed practice. Classes meet twice a week, in person or online, with qualified teachers. |
| Selective school and scholarship interview coaching (Years 8–10) | Coaching to help students prepare for selective school and scholarship interviews: clear speaking, thoughtful answers and confidence. Small groups with qualified teachers. |
| SEAL and private school scholarship preparation | Structured preparation for SEAL and private school scholarship assessments in small groups, taught by qualified teachers. |
| NAPLAN preparation (Years 2–9) | Help students become familiar with the NAPLAN format, timing and question types through guided practice in small groups, in person or online. |
| ICAS preparation (Years 5–10) | Practice and guidance for the ICAS competitions, so students approach the papers with confidence. Small groups, twice a week, in person or online. |
| Maths, Science and English tutoring (Years 5–10) | Small-group tutoring that builds understanding and study habits in Maths, Science and English. Classes meet twice a week, in person or online. |
| VCE tutoring (Years 11–12) | VCE tutoring in Chemistry, General Mathematics, Mathematical Methods, Psychology and Business Management. Small groups taught by qualified teachers. |
| VCE subject-selection counselling | A conversation for students and parents together about choosing VCE subjects, with guidance from experienced teachers. |
| UCAT and GAMSAT preparation (new for 2027) | New UCAT and GAMSAT preparation. Enrolments are open now and classes start in January 2027. *(Year levels, format and fees left out until confirmed.)* |

### 6.3 Things learned
- The owner panel's editor is an iframe on the same `google.com` origin, so file inputs and buttons inside it can be reached from the page.
- The service form: price defaults to "No price"; leave it. Click the service row with a real click, wait for the form to load, then type into the description and press **Save**. Clicking before the form loads opens the wrong item.
- Custom services take a name only on first add (120 limit); descriptions are added by editing each service.
- Q&A is still available on this profile (Google had been retiring it elsewhere).
- Verification can take days. An unverified profile shows "NOT PUBLICLY VISIBLE".

### 6.4 Still pending
- [ ] **Wait for verification approval** (email to `hello@ajclasses.com.au`).
- [ ] Confirm the address decision above.
- [ ] Additional categories: Test preparation center, Educational consultant.
- [ ] Opening hours ([TBC]).
- [ ] Q&A seeds (launch-kit 3.2) and the three Updates posts (launch-kit 3.3), after verification.
- [ ] Real photos of the teaching space (no students).
- [ ] Review request message to parents (launch-kit 3.4; ethical rules: no incentives, no gating, ask parents not students).

---

## 7. Instagram

**Account:** `@aj_classes_au` · display name "AJ Classes" · `https://www.instagram.com/aj_classes_au/`

### 7.1 What happened
1. The first account was locked at `accounts/suspended` with an "Upload a verification selfie" check. This is an identity check, so the owner completed it and submitted an appeal on 22 Oct 2026.
2. The appeal was approved. The account then worked normally.
3. `instagram.com/accounts/edit/` → bio typed, profile photo set by upload, **Submit**.

### 7.2 Values entered
**Bio (116 of 150 characters, with line breaks):**
```text
Every student can rise.
Small-group tutoring: Williams Landing, Truganina, Craigieburn + online
Enrolling for 2027 ↓
```
**Profile picture:** `facebook-profile-800.png` (logo on navy).

### 7.3 Things learned
- The web Edit Profile page has two hidden file inputs; the first is the profile photo.
- **The website link can only be edited in the phone app.**
- The Business/Professional account switch is not on the web Edit Profile page. Use the phone app.
- Repeated sign-ups from a browser raise the chance of a lock. Use the phone app with a real number for new accounts.

### 7.4 Still pending
- [ ] Switch to **Professional → Business**, category Tutor/Teacher (phone app).
- [ ] Add link `https://ajclasses.com.au/#contact`; contact options (email, phone); connect to the Facebook Page.
- [ ] Name field: `AJ Classes | Tutoring` (21 characters).
- [ ] Highlights from `instagram/highlights/`: Programmes, 2026 Results, Teachers, How it works, UCAT & GAMSAT, Enrol 2027.
- [ ] Grid posts: publish **post 9 first and post 1 last** so the grid reads 1–9. Captions, hashtags and alt text are in launch-kit section 9. Reels (posts 1 and 7) need real videos.
- [ ] DM greeting, away message and saved replies (section 9 below).
- [ ] Optionally change the handle to `ajclassesau`.

---

## 8. WhatsApp Business (done by the owner on the phone)

WhatsApp Web rejects the built-in browser ("works with Google Chrome 100+"), and business profile editing is only available in the phone app. Setup was done by the owner in the phone app under **Settings → Business tools**.

| Field | Value |
|---|---|
| Business name | `AJ Classes` |
| Category | Education |
| About (139 limit) | `Small-group tutoring in Melbourne and online. Message us about 2027 enrolments.` |
| Description (256 limit) | `Small-group tutoring in Williams Landing, Truganina and Craigieburn, and online across Australia. Selective entry, scholarships, NAPLAN, ICAS, VCE and UCAT/GAMSAT, taught by qualified teachers with Working With Children Checks.` |
| Email / website | `hello@ajclasses.com.au` / `https://ajclasses.com.au` |
| Profile picture | `facebook-profile-800.png` |
| Greeting, away message, quick replies | See section 9 |
| Labels | New enquiry, Selective, NAPLAN/ICAS, VCE, UCAT/GAMSAT, Enrolled |
| Catalogue | **Not set up** (decision: leave it for now). If added later, item names and descriptions can reuse the Google services table; each item needs an image, prices left blank. |

Compliance: only message people who contacted you or opted in (Spam Act 2003); don't add parents to groups without consent.

---

## 9. Auto-replies (copy and paste)

Use on WhatsApp Business, Messenger and Instagram DMs. Replace each `[TBC: …]` before use, or remove that sentence if the answer is not decided.

**Greeting**
```text
Hello, and welcome to AJ Classes. Every student can rise. Thanks for getting in touch. We're enrolling now for 2027. Tell us your child's year level and what you'd like help with (for example selective entry, NAPLAN, VCE or UCAT/GAMSAT), and we'll reply with the next steps. You can also register interest at https://ajclasses.com.au/#contact
```
**Away message**
```text
Thanks for your message. We're away from our phones right now, but we'll reply on [TBC: reply times, e.g. the next business day]. In the meantime you can register interest for 2027 at https://ajclasses.com.au/#contact or email hello@ajclasses.com.au.
```
**Quick replies**

`/fees`
```text
Thanks for asking about fees. [TBC: fees per programme and year level, billing frequency and any other costs]. If you tell us your child's year level and the programme you're interested in, we'll confirm the details.
```
`/locations`
```text
We teach in person in Williams Landing, Truganina and Craigieburn, and online anywhere in Australia. [TBC: venue addresses and which programmes run at each location]. Which area suits you best?
```
`/years`
```text
We support Years 2–12: NAPLAN (Years 2–9), ICAS and Maths, Science and English (Years 5–10), selective entry exam preparation (Years 6–10), interview coaching (Years 8–10), VCE (Years 11–12), plus SEAL and scholarship preparation [TBC: year levels] and UCAT/GAMSAT [TBC: year levels]. Which year is your child in?
```
`/enrol`
```text
Enrolling is simple. Register interest at https://ajclasses.com.au/#contact, or reply here with your child's year level and the programme you're interested in. We'll get back to you with the next steps [TBC: assessment or trial class, availability, payment].
```
`/online`
```text
Yes, we teach online as well as in person, so students anywhere in Australia can join. [TBC: online platform, class times and what students need]. Tell us the year level and programme and we'll let you know what's available.
```

---

## 10. Automation notes (how the browser steps were done)

For anyone repeating this with the browser pane:
- **Sign-in, passwords, OTPs, CAPTCHAs, identity/selfie checks, verification videos and security settings are always done by the owner.**
- Hidden file inputs can be filled from page JavaScript: render an SVG to a canvas, convert to a `File` with `canvas.toBlob`, put it in a `DataTransfer`, assign `input.files`, then dispatch a `change` event. A `fetch` from a local server was blocked by the sites' security policies, so images were built in the page.
- Facebook, YouTube and Instagram uploads worked this way. Google's photo tool needed the same approach inside its iframe.
- Take a screenshot after each action. Several typing mishaps (text in the wrong field, doubled characters, autocomplete interference) were caught that way.
- The pane is narrow: some dialogs hide buttons off-screen. Use `find`/page JavaScript to locate them.
- Anything that publishes or submits, accepts terms, or changes an account setting was confirmed with the owner first.

---

## 11. Consolidated open items

**Owner-only (security, identity, decisions)**
1. Wait for Google Business verification; check `hello@ajclasses.com.au`.
2. Decide whether the Truganina address can be shown publicly or must be hidden (service-area only).
3. Two-factor authentication and a second admin on Facebook, Google, YouTube and Instagram.
4. Switch Instagram to Business and add its link (phone app).
5. Rotate the password that was shared in chat.

**Facts needed to remove every [TBC]:** venue addresses, opening hours, fees per programme, maximum class size, online platform and times, year levels for SEAL/scholarship and UCAT/GAMSAT (and class format and fees for UCAT/GAMSAT), teacher names/bios/photos with written consent, what happens after "register interest" (trial, assessment, payment), confirmation that the 2026 results figures can be published, the Google review link, and the plan start date.

**Next work (can be done by automation once signed in)**
- Facebook: Messenger greeting/away/saved replies (via Meta Business Suite, owner signed in), username retry.
- Google (after verification): extra categories, hours, Q&A, three Updates, review link.
- Instagram: highlights, nine grid posts, DM automations.
- YouTube: trailer, playlists, watermark.
- Four-week posting plan (launch-kit section 10), starting after the grid is live.
