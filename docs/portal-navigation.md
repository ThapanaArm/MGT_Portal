# MGT Portal navigation and request workflow

The Portal ends at application approval. IT performs deployment outside the Portal. SSO integration and the Token/API authorization redesign are deferred; existing credential and personal-token flows are retained.

The website-structure article supplied by the user informed hierarchical navigation and sequential request forms: https://enfete.co.th/th/website-structure/. It is a design reference, not a source of authorization requirements.

## Navigation

- Dashboard (`/dashboard`): the sign-in destination, own draft/pending/approved/suspended counts, recent own requests, catalog totals, and a reviewer workbench where authorized.
- My application requests (`/my-apps`): list, preview, three-step draft form, detail summary, and submission.
- API Catalog (`/explore`): discover services by business category and explicit source-platform metadata.
- Request guide (`/getting-started`): tier requirements and the approval-to-offline-IT handoff.
- Ecosystem (`/ecosystem`): approved request records. Approval is not a deployment assertion; sharing copies the Portal catalog link rather than constructing an unverified live URL.
- Requests and reviews (`/reviews`): visible to assigned committee members and administrators. The old administrator review route redirects here.
- Administration: catalog maintenance and existing access administration. Committee account assignment is available from the review workbench.
- Design System and Example: reusable component guidance and the independent example application.

## Request form

1. Application details: name, purpose, requested subdomain, repository, and optional branding/screenshots.
2. Audience and tier: audience selection, explicit Tier 1/2/3 requirements, and existing business category choices. A service selection moves a Tier 1 draft to Tier 2. Official Tier 3 submissions require an IT administrator owner on the server.
3. Review summary: details, creator, audience, tier, and required checkpoints. Save the draft, then explicitly submit from its detail page. The preferred tier is passed to that page for confirmation.

The summary distinguishes committee decisions from IT review. Tier 1 is auto-approved without IT review. Tier 2/3 need three attributed votes plus a passed IT review. A committee request for changes requires a reason and returns the application to Draft. A subsequent submission starts a new review cycle.

## Committee identity

Migration `CatalogPlatformsAndCommitteeIdentity` adds optional real-user links to existing committee seats, vote actor/time/note fields, and source-platform metadata on catalog endpoints. It does not assign accounts or invent source platforms. An account can hold only one seat. A seat with a decision in a pending review cannot be reassigned.

Voting resolves the seat from the signed-in user ID; the client never supplies a member ID. An administrator without a seat can inspect requests and perform the existing IT review, but cannot vote as a committee member. Unattributed legacy votes are displayed explicitly and do not count toward a new review completion. Existing approved requests are preserved. Committee access to pending request details excludes credentials unless the reviewer separately qualifies as the owner or administrator under the existing rules.

Before using reviews, an administrator must link the existing committee seats to the intended real accounts. The composition of the committee and any future data-owner policy remain an organizational decision; no automatic assignment is made.

## Source platforms

Source platform is descriptive metadata on each endpoint, separate from its category and scope. Administrators may enter SAP, Zoho, Fabric, SalesApi, or another verified source. Existing records show Not specified until edited. No source-system credentials, Gateway behavior, scopes, or token issuance rules are changed.

## Example

`/design-preview/application-requests` adds a separate local request example to the existing workspace. It demonstrates audience/tier selection, request summary, attributed committee checkpoints, a separate IT review, and approval without deployment. Its sample records use a dedicated browser-storage key and do not call real request or approval APIs. Other sample users' seeded decisions are read-only; the current sample account records only its own approval.
