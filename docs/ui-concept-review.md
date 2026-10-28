# MGT Portal UI alignment review

Follow-up implementation: Dashboard, sequential request forms, request summaries, authenticated committee voting, explicit account assignments, source-platform metadata/filtering, approval wording, and a local application-request Example have now been implemented. The table below preserves the original assessment. See `portal-navigation.md` for the current behavior and setup requirements. SSO and Token/API redesign remain deferred by the user.

Reviewed against the supplied architecture document dated October 16, 2026, the user's clarified requirements, and current implementation. The document is reference material; unresolved choices remain unresolved.

The UI partially supports the intended request-and-approval portal. A visual refresh does not establish the required authorization or integration behavior. Deployment is performed by IT outside the Portal, and the document explicitly says the Portal does not track deployment work.

| Area | Current implementation | Required direction |
| --- | --- | --- |
| API discovery | Explore and Category pages provide business search, endpoints, and scope labels. CategoryDto has no source-platform field. | Make source platforms such as SAP and Zoho visible separately from business categories. Use actual catalog metadata rather than inferring a platform. |
| Application request | AppForm captures application details, subdomain, GitHub, API products, and audience. Tier is chosen when submitting from AppDetailPage. | Present a clear request summary including tier, creator type, audience, required scopes, and approval requirements. |
| Tier rules | Tier 1 has no API credentials and is auto-approved. Tier 2/3 require three votes and IT code review. | Keep the independent committee and IT review states visible; do not imply approval means deployment. |
| Lifecycle wording | AppDetailPage shows Publish/Unpublish and describes Active as production access. | Explain Active as approval/access state. Label actions according to their actual suspend/reactivate behavior. Do not add a deployment tracker. |
| Committee identity | AdminReviewPage lets an administrator click each committee member. ApplicationsController accepts an arbitrary committeeMemberId from an admin. | Each committee member must sign in and record their own decision. Enforce identity on the server; a UI-only change cannot satisfy this requirement. Committee composition is still undecided. |
| API scope approval | AppForm selects category products, and AppDetailPage displays environment credentials. TokensPage separately creates personal tokens with a list of scopes. | Show requested versus approved scopes per application and environment. Make the relationship among application, approval, scope, and credential explicit. Do not describe the current personal-token flow as complete app-scoped authorization. |
| Additional scopes | The current workflow only edits API products for draft/suspended apps. | The document requires a new approval request while an active app retains its previously approved scopes. This needs workflow/data changes, not just different copy. |
| SSO | LoginPage uses local prototype credentials. Its SSO button displays a prototype notice. | Real shared sign-in requires Entra ID/OIDC integration per app. Do not claim SSO is implemented. |
| Ecosystem | Catalog cards are based on approved/published records. App launch currently displays a simulation notice. | Do not imply the Portal deployed an app. Whether to store the deployed application URL is explicitly an open decision in the document. |
| Example website | The example demonstrates people, requests, and sales workflows. | Treat it as an example of an application built using the shared design system, not a simulation proving the Portal's approval, Gateway, or SSO architecture. |

## Icon changes completed

UI action, navigation, feedback, and authentication icons now use the existing Font Awesome dependency through the shared Icon component, across the real Portal, Design System explorer, and example website. The icon picker offers Font Awesome icons only. Known legacy emoji IDs from database records are rendered through a compatibility map; records and uploaded images are preserved. SVG data charts remain charts.

## Recommended implementation order

1. Clarify request/approval wording and show independent review gates and scope summaries.
2. Implement authenticated committee voting and per-application approved scopes with server enforcement.
3. Add separate source-platform metadata and support additional-scope requests without suspending existing access.
4. Integrate Entra ID/OIDC and Gateway credential enforcement. Keep offline IT deployment outside the Portal.
