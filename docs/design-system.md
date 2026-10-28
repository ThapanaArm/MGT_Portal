# MGT Portal visual standards

All authored interface copy must be English, including navigation, labels, placeholders, validation, notifications, accessibility text, examples, and API error messages. Display database content in its original language without translating or filtering it. The portal declares `lang="en"` and uses the English dictionary only. Run `npm run check:ui-language` in `src/Web` to detect Thai text in authored UI strings and JSX.

The running portal and its Design System explorer share the tokens in `src/Web/src/styles/portal.css` and the `Btn`/`Panel` components in `src/Web/src/shared/components/ui.tsx`.

- Keep MGT Blue for primary actions and links; MGT Green for brand accents and success. Selected navigation uses a blue tint with a green indicator.
- Inputs use an 8px radius, standard buttons 11px, cards 12px, feature panels 16px. The sidebar stays square and flush to the viewport.
- Standard buttons and inputs are 42px high; small buttons are 32px. Use 16/24/32px spacing between related content, sections, and large regions.
- Navigation and feedback may use subtle glass. Tables, forms, and content cards use opaque surfaces and thin borders.
- Keep sidebar groups collapsible with a simple label and chevron. No connecting tree lines. The collapsed rail uses the logo as the expand control.
- Breadcrumbs and user controls share one contextual bar. Content fills the available workspace width.
- The authentication screen follows the approved dark split-panel pattern; its styles are isolated in `features/auth/auth.css`.
- Update the explorer whenever a shared component changes. Button examples use the actual `Btn` component; token samples show current theme values.

Check light/dark themes, a narrow viewport, and shared-component specimens before accepting a design change.

## Workspace interactions

The real Portal starts at `/dashboard`, with own-request status counts and a review workbench available to committee/admin accounts. Request and review layouts live in `styles/governance.css`. The application form uses a three-step sequence and a summary before saving; submission remains an explicit action on the detail page. Separate committee and IT review gates are shared visual patterns. No deployment tracker is part of the Portal. See `portal-navigation.md` for the complete workflow and committee setup requirements.

All interface icons use the shared `AppIcon` in `shared/components/Icon.tsx` and the installed Font Awesome solid icon set. The picker stores `fa:` IDs only. Legacy emoji IDs resolve to Font Awesome at render time without modifying database records. Uploaded application images and SVG charts are content rather than interface icons.

`styles/workspace.css` is the shared product layer for the real Portal and example website. It provides heading hierarchy, navigation states, card elevation, selected table rows, filter bars, and dialog/drawer motion. Keep animations between 150 and 220ms and disable nonessential movement for reduced-motion preferences.

Ecosystem cards are keyboard-accessible links. Only use application-provided images and icons; do not fabricate product screenshots. The catalog has explicit loading, error/retry, empty, and filtered-empty states. `EmptyState` is shared with My Applications. My Applications and example sales orders offer a Preview drawer with an explicit link to the full detail page. Example dashboard counts and review actions derive from its existing records.

## Spacing and composition

- Use 8px between a heading and its description, 16px between a panel heading and its content, and 24px between sections and form fields.
- `Panel` groups its title and hint in `.portal-panel-heading`; the heading owns the spacing before the content, including when there is no hint.
- Standalone panels have 24px bottom spacing and no trailing margin when last. Grid containers own their gaps: direct panel children must have zero bottom margin so spacing does not double.
- Grid children use `min-width: 0` to keep long content from expanding their columns. Tables scroll inside their frame.
- Text fields use the standard 42px minimum height. Checkbox, radio, range, color and file inputs retain their specialized geometry.
- Environment and application type chips share `.portal-chip`. Mobile action groups may wrap, and list search fields must fit the available width.

## Example module

The Patterns tab has a single new-tab link to /design-preview. The independent React module lives in src/Web/src/features/example; it does not render inside PortalLayout.

- ExampleModule.tsx owns routing and the local demonstration provider.
- components/ExampleLayout.tsx composes navigation, page heading and confirmation dialog.
- components/OrderTable.tsx composes shared table controls and order actions.
- pages/ contains LandingPage, LoginPage, VerifyPage, DashboardPage, OrdersPage, OrderFormPage, OrderDetailPage, SettingsPage, SolutionsPage, ContactPage, HelpPage, ForgotPasswordPage and NotFoundPage.
- useExampleModel.tsx holds demonstration state and CRUD operations; data.ts defines the sample records and calculations.
- shared/components/design-system.tsx exposes the production primitives. The Design System explorer and example pages import those exact components. AppForm in the Portal also uses the shared Input and Textarea primitives, alongside Btn and Panel.
- styles/design-system.css owns component appearance. example.css is for page composition and responsive layout.

The Design System keeps the 32-family usage map outside the simulated website. Examples include date/time, file selection, password visibility, OTP, stepper, slider, switch, checkbox/radio, tabs, menu, pagination, table/cards, list, statistics, timeline, tree, badges/chips/avatars, accordion, alerts, toast, progress, skeleton, dialogs/drawers, tooltip/popover and page layout.

The order feature demonstrates list/detail/create/edit/delete, filtering, sorting, pagination, bulk selection, line items and VAT, validation, cancellation and confirmation, unsaved changes, and loading/empty/error/retry states. Settings demonstrates the remaining controls in context. No real sign-in, file upload or business API mutation occurs. Orders, workspace settings and members persist in example-specific browser storage. Mock authentication uses a separate sessionStorage flag and never changes the real Portal session.

The website is presented as MGT Workspace, with business content and no component index, debug state controls, demo banners or developer copy in its navigation. The DS entry provides mock credentials (sales@example.com / demo1234 / OTP 123456). Login validation, verification, protected pages and logout are simulated locally. Public solutions/contact/recovery pages, help and 404 complete the site flow; contact/recovery confirmations do not send network requests.

The simulation is an organization workspace rather than a sales-only product. PeoplePage, RequestsPage and the order feature demonstrate the same public DataTable<T>, fields, dialogs, badges and feedback in different business contexts. The main dashboard aggregates people, approvals and orders. Personnel CRUD and generic requests/approval are local examples, not a full HRMS implementation. Component documentation stays in the DS explorer.

Workspace navigation now shares SidebarFrame/SidebarItem/SidebarGroup from shared/components/Sidebar.tsx and AccountControls/ContextBar from shared/components/AccountControls.tsx with the real Portal. Authenticated example screens use a flush sticky sidebar with collapse/logo-hover expansion and a mobile drawer, plus the same glass context bar. Public landing/login/contact pages keep the top navbar.

## Glass feedback
Shared feedback lives in shared/components/feedback.tsx and styles/feedback.css. Alert, Toast and confirmation Dialog share semantic SVG icons, glass surfaces and visible 2px outlines. Toasts sit at the upper right, use a 376px maximum width, stack up to three, can be dismissed, and pause the expiry timer while hovered or keyboard-focused. useToast accepts a string or {message, title?, tone?, duration?, action?}; duration 0 keeps a message until dismissed. Confirmation dialogs use the confirmation prop and tone; form dialogs and drawers retain their standard layout. Respect reduced motion and opaque fallback when backdrop-filter is unavailable.

Button variants and sizes now live in styles/buttons.css, with start/end icon slots, 11px default corners, 42px standard height and 32/48px compact/large sizes. The shared Btn owns hover, active, focus, loading and disabled treatment. Confirmation icons reflect the actual action (approval success, destructive danger, general info), with explicit action labels and a restrained 1px modal frame; toast outlines remain 2px at the upper right.

The DS launch link now opens /design-preview/login?start=1 to start a fresh mock login flow, then goes directly to the workspace dashboard. The marketing landing page is available separately at /design-preview/welcome. OTP remains an optional security example reached through settings. Resetting mock authentication never clears business demonstration records or affects Portal authentication.

### English example website
All example routes use English interface copy, validation, confirmation dialogs, notifications, accessibility labels, and seed data. Known legacy Thai demo values are normalized on load without clearing locally saved records. User-entered content is preserved. The example sets the document language to English and restores the previous language on exit.

The Organization page Tree demonstrates Company → Department → Team → Employee using the current employee directory. Branches expand and collapse; selecting a company, department, or team filters the directory; selecting an employee displays their profile. Settings remains a separate form without an unrelated tree. Existing flat Tree groups remain supported.

### Charts

Eight shared React components are available from `@/shared/components/charts`: `BarChart`, `HorizontalBarChart`, `StackedBarChart`, `LineChart`, `AreaChart`, `ComboChart`, `DonutChart`, and `PieChart`.

Cartesian charts accept `title`, optional `description` and `unit`, ordered `labels`, and `series: { name, values: (number | null)[] }[]`. Keep series aligned with labels; use null for missing observations. Optional `formatValue` formats inspected values and the data table. Combo charts render the first series as bars and subsequent series as lines using one shared unit. Stacked bars support positive and negative contributions; use mutually exclusive categories rather than summing overlapping measures.

Horizontal bars, pie, and donut charts accept `data: { label, value }[]`. Pie and donut charts exclude negative/non-finite values with a visible explanation. Zero totals show an empty state. All charts expose focusable values, a persistent inspection readout, and an expandable data table. The gallery at `/design-preview/charts` includes standard, missing/negative, single-point, all-zero, and empty examples. The Example Dashboard uses order values and request statuses from its local data.

Brand anchors retain MGT Blue and MGT Green. Liquid glass navigation, translucent cards, restrained blue/green gradients, table headings and rounded controls add subtle color to the interface. Cyan and violet are not interface brand colors. Chart colors retain the existing palette, and approval/error status badges keep their established meanings.

### Filter examples and modal sizes

`FilterToolbar`, `FilterChipGroup`, and `ActiveFilterChips` are shared controlled components in `shared/components/filters.tsx`. The Example gallery at `/design-preview/filters` demonstrates six layouts on the same local sales orders: quick status chips, inline dropdowns, an advanced panel, an anchored popover, a centered modal, and a side drawer. Search and quick controls apply immediately; advanced forms require Apply filters. Cancel preserves applied conditions. Applied conditions appear as removable chips. Status values combine with OR; different fields combine with AND. Date boundaries are inclusive, and amounts include VAT. Reset fields edits the draft; Clear all clears applied conditions and search.

Shared `Dialog` accepts `size="sm" | "md" | "lg"`. Medium (640px) is the default for centered dialogs, small (420px) is the default for confirmations, and large (880px) is available for dense forms. Widths respect a 16px viewport margin. Standard dialogs share a header, scrollable content, and optional action footer; drawers retain their side placement and width. The Components overlay specimen exposes all three sizes.

### Request ownership and IT preparation

Application request details separate the requester, IT administrator, and assigned committee views. The requester owns business details and submission; the repository is displayed read-only and is excluded from business-user request forms. IT manages the repository through an admin-only update endpoint after the request is submitted. The endpoint updates repository metadata and logs the administrator without changing the request owner, review cycle, votes, or approval status. HTTPS URLs with embedded credentials are rejected. The general create/update endpoints also prevent a non-admin requester from assigning or changing the repository.

The IT view does not submit another user's draft. Drafts show Awaiting submission; submitted requests expose IT preparation and the review workbench. Approval grants permission for IT deployment; deployment itself remains outside the Portal. Page copy is intentionally brief, with Overview, IT preparation (admin only), Review, and Activity tabs.

### Development-to-deployment prototype

`/design-preview/development-flow` is an isolated, in-memory Tier 2 workflow example. It separates a development access request from a later deployment approval request. Preview roles are Requester, IT, and Reviewer; these controls simulate roles and do not modify authenticated Portal permissions. Collaboration creates one Git/API preparation row per developer. Missing setup keeps the development handoff disabled. The deployment request records a sample branch and commit, and its example approval requires three sample committee decisions and a separate IT review. This sample committee is illustrative, not the production approver selection policy. Request changes returns to development and clears the previous approvals and commit reference.

The prototype does not create real Git tokens, API credentials, repositories, invitations, Microsoft accounts, or notifications. It has no backend workflow calls and does not change real application requests. Reset clears only the in-memory example.
