# Student Web entry (local review)

The student entry follows the supplied reference's simple header, split welcome/action panel,
and direct task shortcuts, with Aoyama Hack branding. It has no grade-distribution feature.

## Local review

Use Node.js 22.12 or later. In a fresh source copy, install the locked dependencies first.

```sh
npm ci
npm run dev:student
```

Open `http://localhost:5178/`. `/student` also works in the usual Web preview build.
Use this exact origin for live login and uploads. Firebase Auth approves `localhost`, not
`127.0.0.1`; the existing local signed-upload CORS allows `http://localhost:5178` only.
The student preview redirects old loopback/port variants to this approved origin before
initializing Firebase, retaining the route, query and selected tab. No Firebase setting is changed.
On 2026-10-22 a protected Vercel Preview was
deployed manually; the existing shared preview hostname now serves the student build.
No production domain, DNS, or Firebase setting was changed.

- Time table: `/mypage#timetable`.
- Course search: `/mypage#syllabus`.
- AI: `/mypage#timetable`, then an existing course and lecture session.
- Sign-in: existing `/mypage` Google sign-in UI and Firebase setup, unchanged.
- Sign-in now keeps the known destination tab instead of losing `#syllabus`.
- AI pilot admission remains enforced by the existing backend.

The landing is static: it does not initialize Firebase, read user data, or call providers.
It is `noindex` while under review. No auth, AI, timetable, syllabus, or course-chat layout
is replaced. Student CSS is scoped under `.student-portal` and loaded only for that entry.

## Build separation

The normal `build` and `build:ai-preview` still render the existing corporate `/`.
The new `build:student-preview` puts the student landing at `/` and `/student`, using
the same existing application for all following routes; its output is `dist-student`.
Existing production AI guards still apply. A student build is not permission to open AI
to everyone or to modify an existing Vercel project's settings.

## One repository, two destinations (future plan only)

Both can live in `Forta2k25/aoyama-hack-web`:

| Destination | Role | Deployment |
| --- | --- | --- |
| `www.aoyamahack.com` | Corporate/marketing site | Keep the existing Vercel project and corporate build |
| `app.aoyamahack.com` | Student site | Separate Vercel project with student entry/build and isolated release settings |

GitHub stores source and can store build/config declarations. Domain registration and DNS
are managed at the registrar/DNS provider, and domain-to-project mapping at Vercel.
One repo does not require a shared deployment. Configure branch/build triggers per project
before connecting them; Vercel's default can deploy each connected project on a push.
Do not attach the new subdomain to the existing corporate deployment indiscriminately:
adding a second hostname alone would show the same site.

Before any real student-domain launch, separately review Vercel project/protection settings,
production AI feature gating, Firebase Auth authorized domain and Storage upload CORS,
metadata/canonical URLs, and shared-account session behavior. Localhost review does not
change any of these. None of those hosting, DNS, Firebase, or production changes is included here.

References:
- https://vercel.com/docs/monorepos
- https://vercel.com/docs/domains/working-with-domains/add-a-domain

## Protected shared Preview (2026-10-22)

Deployment: `dpl_5iwpM9WDeSsSGp74Eg1sE4wrZ2nK`.
The existing branch Preview alias now serves the student root build. The existing
shareable-link entry and protection configuration are preserved. Use the complete
share link delivered privately; the bare host redirects anonymous visitors to Vercel
authentication. Never commit the share key or URL query. Google login and signed uploads
reuse the already-approved hostname and origin. AI remains pilot-only.

Verified: Preview READY; student build/output; complete share link HTTP 200; anonymous
requests redirect to Vercel authentication; student UI and existing signed-in timetable
in a browser; Firebase Auth host and Storage PUT CORS; unchanged production deployment,
project protection, project build settings and environment configuration. No GitHub update
or Firebase mutation was performed. Source snapshot hash:
`87f1ca7ed4ef8d7347df9ebb69c7f8c69e0d84af40bb0b9606a7081cd456a660`.

## Web branch update (2026-10-23)

The student entry and course-project Web interface are saved to the existing
`codex/web-ai-hack` preview branch. The protected Preview is built with
`build:student-preview`; the tracked Vercel config retains the corporate build
and disables automatic deployment from this branch. Only the manual Preview
deployment overrides the student build/output. Neither main nor the production
domain is updated. The course-wide reference feature remains capability-gated
until the shared `aiChat` and `aiListSources` contract is separately approved and
deployed. The synthetic `/ai-project-debug` page is available for UI review and
does not contact Firebase or an external AI.
