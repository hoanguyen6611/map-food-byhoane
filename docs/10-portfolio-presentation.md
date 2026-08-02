# Portfolio Presentation Plan

## 1. Positioning for a Portfolio Audience

The audience (recruiters, hiring managers, potential collaborators/investors) needs to grasp in under 60 seconds: (1) what problem this solves and for whom, (2) that the engineering decisions are deliberate and defensible, not default choices, (3) that it's a real, working product, not a Figma mockup. Every artifact below is built to prove one of those three in the shortest possible path.

## 2. Demo Data Plan

**Goal:** make the cold-start problem invisible to a portfolio viewer — the app should feel alive on first open, not empty.

- **Volume:** 30–50 restaurants, concentrated in **TP. Hồ Chí Minh** (Quận 1, Quận 3, Bình Thạnh, Phú Nhuận — dense, recognizable areas) to keep the map visually coherent rather than sparse dots across the whole country (per Assumption A2 in the PRD).
- **Category mix:** roughly 40% quán ăn, 25% quán cà phê, 15% xe đẩy/quán vỉa hè (to demonstrate the "informal vendor" differentiator explicitly), 10% nhà hàng, 10% quán bar/nhậu.
- **Per-restaurant minimum data bar** (so every seeded place looks "real," not placeholder):
  - Real-sounding Vietnamese name, accurate district-level address (can be a real public building's approximate area, not a fabricated specific street number implying a real business exists there — see ethical note below).
  - 4–8 photos per place (food close-ups + interior), sourced from royalty-free/self-shot images, never scraped from a real restaurant's actual social media without permission.
  - A basic menu: 6–12 items with realistic VND prices matching the category (street food 20k–60k, café 25k–70k, nhà hàng 80k–300k).
  - Full 7-day opening hours, including at least 3 places with overnight hours to exercise that edge case.
  - 3–5 facilities tagged per place, varied (not every place has everything — needed to test filter differentiation).
  - 8–20 seeded reviews per place across different simulated users, with varied criteria ratings (not all 5-star — needed to make the composite-score damping and AI summary visibly meaningful), a few including dishes ordered/bill total/photos.
  - At least 5 places with **0 or 1 review** to demonstrate the "not enough data" empty states honestly.
- **Ethical/legal note:** seed data should represent *plausible* Vietnamese food establishments, not impersonate specific real businesses with invented negative reviews or fabricated claims — use either genuinely public, factual info about real well-known spots (properly sourced) or clearly original fictional composites. This avoids defamation/misrepresentation risk in a public portfolio artifact.
- **Seeding mechanism:** a versioned seed script (`prisma/seed.ts` or equivalent) run against a fresh DB — not manual Admin Portal clicking — so the dataset is reproducible for local dev, CI test fixtures, and the deployed demo simultaneously (this doubles as the Testing Strategy's fixture data, see [09-testing-plan.md](09-testing-plan.md) §5).

## 3. README Structure (top-level repo README)

```
# The Food Map of Vietnam

1. One-paragraph pitch + 3 hero screenshots/GIF (map, detail, AI summary)
2. Live demo link (deployed) + demo login credentials (read-only reviewer account)
3. "Why this project" — 3-4 sentences on the product thesis (not Google Maps, food-specific decision-making)
4. Architecture diagram (embed the Mermaid diagram from 05-system-architecture.md, rendered)
5. Tech stack table (condensed from 07-tech-stack.md)
6. Key engineering decisions & trade-offs (3-5 bullets, each linking to the relevant doc section)
   - e.g. "Modular monolith over microservices — see docs/05..."
   - e.g. "React Native over Flutter — see docs/07..."
   - e.g. "AI moderation fails safe, never fails open — see docs/01..."
7. Local setup instructions (docker compose up, seed script, run mobile app)
8. Folder structure overview (backend/ mobile/ admin-web/ docs/)
9. Full design doc index — links to all files in /docs (this document set)
10. Roadmap snapshot (Phase 0-5 table, highlight "MVP shipped, Phase 2 next")
11. License / contact
```

## 4. Case Study Narrative (for a portfolio site / Notion page / blog post)

Structure as a problem → constraint → decision → trade-off narrative, not a feature list:

1. **The problem**: Google Maps answers "what's near me," not "what's right for me." Show 1-2 concrete example screenshots contrasting a generic Maps listing vs. this app's structured detail page.
2. **The constraint**: solo builder, real budget limits, needs to be both demo-able *now* and architecturally honest about scaling later.
3. **Key decisions and why** (pull directly from docs, don't re-derive):
   - Modular monolith vs. microservices.
   - React Native vs. Flutter.
   - Postgres+PostGIS vs. a NoSQL/Firebase-first approach.
   - AI moderation designed to *never* auto-delete, always human-in-the-loop for medium/high risk.
   - Composite scoring designed to resist "2 five-star reviews beat 200 reliable ones."
4. **What's deliberately not built yet, and why** — show the Out-of-Scope list and the Phase 2-5 roadmap; this signals product judgment (knowing what *not* to build) as much as engineering skill.
5. **What I'd do differently at 10x scale** — a short, honest section (e.g., "Postgres search would need to migrate to OpenSearch past ~50k restaurants; here's the trigger condition I defined for that") — this is a strong signal of seniority for reviewers.
6. **Metrics/proof**: screenshots of passing test suite, a Loom/GIF of the E2E user journey (search → detail → review → moderation queue), API response time numbers from the k6 performance test.

## 5. Presentation Assets Checklist

- [ ] 60–90 second demo video: onboarding → map → search+filter → detail with AI summary → write a review → (cut to Admin) moderation queue approving it.
- [ ] 5–8 polished screenshots: Home Map, Search Result+Filter, Restaurant Detail (with AI Summary visible), Write Review, Admin Moderation Queue.
- [ ] Architecture diagram exported as a clean image (not just a code block) for non-technical viewers.
- [ ] Deployed, working demo link (even a limited free-tier deployment beats "clone to run" for recruiter attention spans).
- [ ] A read-only or seeded demo account so reviewers don't have to register to see authenticated screens (Favorites, Profile, Write Review form).
- [ ] This `/docs` folder linked prominently — it *is* a portfolio artifact in its own right, demonstrating product + architecture thinking, not just code.

## 6. Where This Fits in a Portfolio Narrative

Lead with the product thinking (personas, competitive wedge, the "why" behind AI-explainable recommendations), not just "I built a maps app." The strongest differentiator for a portfolio reviewer is seeing that scope was *deliberately* bounded (explicit Out-of-Scope list, phased roadmap, stated assumptions) rather than either (a) an unfinished sprawl or (b) a toy demo with no real architecture behind it. This document set itself — PRD, ERD, architecture, roadmap, test strategy — is evidence of that judgment and should be surfaced, not hidden in a folder no one opens.
