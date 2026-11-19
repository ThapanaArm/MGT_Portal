# Proposal: App notices (status announcements stored in the Portal)

Status: **draft, not built yet** (agreed 2026-11-18 to implement later)

## Why

MGT Portal is the central catalogue of company apps. The apps themselves are built and run
elsewhere, each with its own database. The Portal already knows the *request* state of every app
(draft, in review, deploying, live, suspended, rejected) and shows fixed copy for it from code
(`appState()` in `src/Web/src/features/apps/components/AppShowcase.tsx`).

What the Portal cannot know on its own is what is happening inside a running app, for example:

- "Maintenance on Friday 20:00–22:00, the system will be unavailable"
- "Version 2.0: the menu has moved, see the guide"
- "This system is being retired, use system X from 1 Jan"

These are announcements a person writes. They belong in the **Portal database** (not in each
app's database), so staff see them in one place.

## What stays in code

- Copy for the Portal's own request states (`appState()`), because it is derived from workflow
  data already in the database and changes rarely.
- Colours and icons per severity (CSS in `app-showcase.css`).

## Data model (Apps module)

New table `AppNotices`:

| Column | Type | Notes |
|---|---|---|
| Id | int, identity | |
| ApplicationId | int, FK → Applications (cascade) | |
| Severity | nvarchar(10) | `info` / `warning` / `danger` |
| Title | nvarchar(100) | e.g. "Scheduled maintenance" |
| Message | nvarchar(500) | Plain text |
| StartsAt | datetime2, null | Shown from this time (null = now) |
| EndsAt | datetime2, null | Hidden after this time (null = until removed) |
| CreatedBy / CreatedAt | | Audit (also captured by AuditLogs) |
| UpdatedBy / UpdatedAt | | |

One app can have several notices; the page shows the active one with the highest severity, and a
"more notices" link if there are others.

## API

- `GET /api/applications/{id}/notices` – active notices (anyone who can see the app)
- `POST /api/applications/{id}/notices` – create (IT admin or app owner)
- `PUT /api/applications/{id}/notices/{noticeId}` – edit
- `DELETE /api/applications/{id}/notices/{noticeId}` – remove
- Include active notices in `AppDetailDto` and a `noticeSeverity` flag in `AppSummaryDto` so the
  Ecosystem cards can show a small marker without extra calls.

## UI

- App page hero: an active notice replaces the automatic notice box (same layout and colours).
- "Manage notices" for IT / owner on the My apps request page: list, add, edit, remove, with
  start / end dates.
- Ecosystem: a small warning marker on cards with an active `warning` / `danger` notice; optional
  banner on the Ecosystem page for `danger` notices.

## Later (optional)

- Let an app post its own notice (for example "system down") through the Gateway with its app
  credential, so outages appear without someone typing them.
- Notify users who opened the app recently (email / Teams) when a `danger` notice is posted.

## Out of scope

- Reading data or health from the apps' own databases.
- New workflow states such as `maintenance` / `deprecated`. If these are needed as real states,
  add them to the workflow, not as notice text.
