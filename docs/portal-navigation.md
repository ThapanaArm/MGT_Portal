# MGT Portal navigation and request workflow

The Portal ends at application approval. IT performs deployment outside the Portal. SSO integration and the Token/API authorization redesign are deferred; existing credential and personal-token flows are retained.

The website-structure article supplied by the user informed hierarchical navigation and sequential request forms: https://enfete.co.th/th/website-structure/. It is a design reference, not a source of authorization requirements.

## Navigation

- Dashboard was removed (2026-11-18); `/dashboard` redirects to the MGT Ecosystem, which is the sign-in destination.
- My application requests (`/my-apps`): list, preview, three-step draft form, detail summary, and submission.
- API Catalog (`/explore`): discover services by business category and explicit source-platform metadata.
- Request guide (`/getting-started`): tier requirements and the approval-to-offline-IT handoff.
- Ecosystem (`/ecosystem`): approved request records. Approval is not a deployment assertion; sharing copies the Portal catalog link rather than constructing an unverified live URL.
- Requests and reviews (`/reviews`): visible to administrators, to committee members, and to anyone who was on the committee of an earlier request. Committee members see only their own requests. The old administrator review route redirects here.
- App Management (IT): Review queue (with a Rejected tab to reopen requests for development), IT preparation and Deployment. The committee is set in Administration > Committee (`/admin/committee`).
- IT Calendar (`/calendar`): IT available slots, deployments, meetings and freeze periods (`CalendarEvents`, `Modules/Scheduling`). Users book a deployment or meeting inside an available slot; IT confirms or declines with a reason. Other people's bookings show only as Booked.
- Administration: catalog maintenance and existing access administration.
- Design System and Example: reusable component guidance and the independent example application.

## Request form

1. Application details: name, purpose, requested subdomain, repository, and optional branding/screenshots.
2. Audience and tier: audience selection, explicit Tier 1/2/3 requirements, and existing business category choices. A service selection moves a Tier 1 draft to Tier 2. Official Tier 3 submissions require an IT administrator owner on the server.
3. Review summary: details, creator, audience, tier, and required checkpoints. Save the draft, then explicitly submit from its detail page. The preferred tier is passed to that page for confirmation.

The summary distinguishes committee decisions from IT review. Every request has a committee of five (requests that had three were moved to five by migration `CommitteeReject`). Register needs 3 of 5 attributed approvals and no IT review. Verify and Official need all 5 approvals plus a passed IT review. A committee request for changes requires a reason and returns the application to Draft; a subsequent submission starts a new review cycle. A committee member can also Reject with a required reason: once the rejections make the required approvals impossible (1 for Verify/Official, 3 for Register), the request becomes Rejected, its credentials are revoked, and it cannot be edited or sent again.

## Committee identity

One committee of five people reviews every request (`CommitteeMembers`). IT sets it in Administration > Committee (`PUT /api/committee/members`); all five seats must be filled by different people. When a request is sent for review the committee is copied to that request (`AppReviewers`). A requester who is on the committee sits out their own request, which then has four members (`Applications.CommitteeSize` = 4).

Votes are bound to the signed-in user account (`AppVotes.ReviewerUserId`); the client never supplies a member ID. Only votes from the application's current committee count. Changing the committee updates every request awaiting review: a removed member's decision for the current cycle is discarded, and the new member must decide. Every change is written to the application log.

An administrator who is not on a request's committee can inspect it and perform the IT code review, but cannot vote. Unattributed legacy votes are displayed explicitly and do not count. Committee access to pending request details excludes credentials unless the reviewer separately qualifies as the owner or administrator.

Migration `PerApplicationReviewers` replaced the three shared seats with per-request committees. Migration `CommitteeMembers` (2026-11-18) brought back one shared committee, now of five people linked to user accounts; it starts empty until IT fills it, and requests already in review keep their committee until then.

## Source platforms

Source platform is descriptive metadata on each endpoint, separate from its category and scope. Administrators may enter SAP, Zoho, Fabric, SalesApi, or another verified source. Existing records show Not specified until edited. No source-system credentials, Gateway behavior, scopes, or token issuance rules are changed.

## Example

`/design-preview/application-requests` adds a separate local request example to the existing workspace. It demonstrates audience/tier selection, request summary, attributed committee checkpoints, a separate IT review, and approval without deployment. Its sample records use a dedicated browser-storage key and do not call real request or approval APIs. Other sample users' seeded decisions are read-only; the current sample account records only its own approval.
