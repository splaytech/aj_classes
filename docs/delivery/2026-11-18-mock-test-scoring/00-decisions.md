# Mock test scoring — team-lead rulings

Saurabh's requirement, verbatim: "do 1-4" (options 1–4 offered on 2026-11-18: marks per question, pass mark, percentage on the result, admin sees results). No reply from him on the decisions below; each is a cheap-to-flip default, and he may overrule any of them.

- **L-1 (names):** the admin results view shows the taker's name (SC8). An admin needs the name to follow up; anonymous scores would make option 4 close to useless.
- **L-2 (who sees; 01 decisions list item renumbered by the PO):** admins only. Tutors do not (smallest privacy surface; widen later on request).
- **L-3 (freeze; 01 decisions list):** marks and the pass mark freeze at release, like questions, so every stored result stays true.
- **L-4 (wording):** "N of M marks", "Pass" and "Not yet", and the percentage rounded down (SC assumptions accepted as written).
- **L-5 (per-question marks on the result):** kept (SC9).
- **L-6 (privacy gate; review-1 #1), written acceptance:** no feature flag and no dark launch. The results view and its function ship live on the shared hosted DB when staging is released, readable only by admins at aal2 (the same gate as every admin page). Before that, only admins (role admin at aal2) can see it, as in 01 AC 36, so admin-only access on staging is accepted. The Privacy Policy line ("admins can see your name and mock test scores") is Saurabh's to approve **before the merge to `main`** (production), and that is the only release gate. 01's release-gate line and R-S1 follow this rule.
