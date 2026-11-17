# MGT Portal navigation and request workflow

The Portal ends at application approval. IT performs deployment outside the Portal. SSO integration and the Token/API authorization redesign are deferred; existing credential and personal-token flows are retained.

The website-structure article supplied by the user informed hierarchical navigation and sequential request forms: https://enfete.co.th/th/website-structure/. It is a design reference, not a source of authorization requirements.

## Navigation

- Dashboard (`/dashboard`): the sign-in destination, own draft/pending/approved/suspended counts, recent own requests, catalog totals, and a reviewer workbench where authorized.
- My application requests (`/my-apps`): list, preview, three-step draft form, detail summary, and submission.
- API Catalog (`/explore`): discover services by business category and explicit source-platform metadata.
- Request guide (`/getting-started`): tier requirements and the approval-to-offline-IT handoff.
- Ecosystem (`/ecosystem`): approved request records. Approval is not a deployment assertion; sharing copies the Portal catalog link rather than constructing an unverified live URL.
- Requests and reviews (`/reviews`): visible to administrators and to anyone IT has selected as a committee member of at least one request. Committee members see only their own requests. The old administrator review route redirects here.
- Administration: catalog maintenance and existing access administration. Each request's committee is selected on its card in the review workbench.
- Design System and Example: reusable component guidance and the independent example application.

## Request form

1. Application details: name, purpose, requested subdomain, repository, and optional branding/screenshots.
2. Audience and tier: audience selection, explicit Tier 1/2/3 requirements, and existing business category choices. A service selection moves a Tier 1 draft to Tier 2. Official Tier 3 submissions require an IT administrator owner on the server.
3. Review summary: details, creator, audience, tier, and required checkpoints. Save the draft, then explicitly submit from its detail page. The preferred tier is passed to that page for confirmation.

The summary distinguishes committee decisions from IT review. Tier 1 is auto-approved without IT review. Tier 2/3 need an attributed vote from every committee member (five; requests created before migration `CommitteeSizePerApplication` keep three) plus a passed IT review. A committee request for changes requires a reason and returns the application to Draft. A subsequent submission starts a new review cycle.

## Committee identity

Each application has its own committee of five people (`Applications.CommitteeSize`; older requests keep three). IT (administrators) selects them on the request's card in Requests and reviews (`PUT /api/applications/{id}/reviewers`) and can replace anyone at any time. The requester cannot be on their own committee, and the same person cannot fill two seats.

Votes are bound to the signed-in user account (`AppVotes.ReviewerUserId`); the client never supplies a member ID. Only votes from the application's current committee count. Replacing a member while the request awaits review discards that member's decision for the current cycle, and the new member must decide. Every change is written to the application log.

An administrator who is not on a request's committee can inspect it and perform the IT code review, but cannot vote. Unattributed legacy votes are displayed explicitly and do not count. Committee access to pending request details excludes credentials unless the reviewer separately qualifies as the owner or administrator.

Migration `PerApplicationReviewers` replaced the three shared seats (`CommitteeMembers`): existing votes moved to the seat's linked account, and requests that were pending at migration time received the previous seat holders as their committee.

## Source platforms

Source platform is descriptive metadata on each endpoint, separate from its category and scope. Administrators may enter SAP, Zoho, Fabric, SalesApi, or another verified source. Existing records show Not specified until edited. No source-system credentials, Gateway behavior, scopes, or token issuance rules are changed.

## Example

`/design-preview/application-requests` adds a separate local request example to the existing workspace. It demonstrates audience/tier selection, request summary, attributed committee checkpoints, a separate IT review, and approval without deployment. Its sample records use a dedicated browser-storage key and do not call real request or approval APIs. Other sample users' seeded decisions are read-only; the current sample account records only its own approval.
