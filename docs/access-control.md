# Access Control: permissions per API

## How to use the UI

1. Open **Admin → Access Control** and search for the person by name, email, or department.
2. Click **View permissions**. Permissions open as a full page, not a modal.
3. Check the person's identity and department. The summary shows APIs available, read-only APIs, and APIs where changes are allowed.
4. **APIs this person can use** lists existing access, including role permissions. Click **Add API**, search the available API table, and click **Add**. New entries start with **Can view data: Own data** and **Can change data: No access**.
5. **Access level** is a separate column: **Read only**, **Changes only**, or **Read and change**. Filter by category and access level, search by API or route, or click **Clear filters**. The page shows how many APIs match.
6. Set **Can view data** and **Can change data** independently. Choose **No access**, **Own data**, **Department data**, or **Company data**. Change access covers supported create/update/delete operations.
7. **Details** shows the routes and whether permission is inherited or set for this person. **Restore role permissions** removes that API's exception when saved.
8. **Remove access** blocks both viewing and changing, including access inherited from the role. The API becomes available to add again.
9. Click **Save changes** in the bottom bar to apply changes. The editor stays open and shows the saved status. **Discard changes** restores the last saved values. Returning to the user list with pending edits shows an inline choice to keep editing or discard them.

Example: set `inventory.stock` to **Can view data: Company data**, **Can change data: No access**. The row shows **Read only**. This does not grant any other Finance or Inventory API.

## Tables and precedence

| Table | Purpose |
| --- | --- |
| Roles | Role defaults in ScopesCsv; category.read/write applies to APIs in that category. |
| Users | Account, role, department, and legacy default row scope. |
| Teams | Departments used to resolve department membership. |
| SaleGroups | Legacy sales-group membership, separate from departments. |
| UserPlatformIds | Links a Portal user to source-system owner IDs (platform sap or zoho). |
| UserTokens | Personal API authentication; store token hashes, expiry and revocation. |
| AccessGrants | Existing additional scopes, used only while active and unexpired. |
| UserApiPermissions | Custom ReadScope/WriteScope for a UserId + ResourceKey. Explicit none overrides role/grant allowances. |
| GatewayWriteRecords | Write audit and idempotency; RequestUserId identifies the calling person for new requests. |

A custom API row wins over Roles and AccessGrants. Resetting removes the row and re-evaluates current defaults. API permissions are checked from the database for every live Gateway call, so a stale browser or personal token cannot retain revoked permission.

A business API may expose multiple methods/routes. Related routes share a ResourceKey (e.g. sales.order); the modal lists those routes explicitly. The catalog supplies other resources. Sales orders, Zoho deals and Zoho quotes are always available because these live Gateway APIs exist even before catalog import.

## Gateway enforcement and source ownership

Live Gateway calls require both the approved application's X-Token-Id/X-Token-Secret and the person's X-User-Token. Application approval, category access, user API permission, and row ownership must all pass. Existing approval, supported-method and same-application write restrictions continue to apply.

- Sales reporting (`GET /api/v1/sales/orders`) uses the API-specific R scope and existing Supabase owner/group filtering before fetching rows.
- SAP passthrough and SAP order writes use sales.order. For legacy SAP records, configure **Gateway:Sap:OwnerField** to a real, writable header field representing the business owner and populate matching **UserPlatformIds**. When no owner field is configured, restricted scopes can access only SAP orders whose successful Gateway create audit identifies a permitted RequestUserId; unassigned historic orders are excluded. Company scope does not need an owner lookup.
- Zoho Deals, Quotes and Sales_Orders use sales.deal, sales.quote and sales.order. Owner.id is matched to UserPlatformIds with Platform=zoho. Restricted creates default Owner to the calling user's mapped ID. Changing Owner outside the permitted CUD scope is rejected.
- Restricted source collections are filtered before returning any data. Client selections retain the owner field needed for verification. These passthrough collections filter the upstream page rather than computing a global visible-record total. SAP unfiltered totals/continuation links and Zoho unfiltered counts are suppressed. Use explicit page/skip requests for additional source pages.
- API schema/field metadata still requires R permission but has no row-ownership check.
- DELETE remains unavailable wherever the source Gateway already blocks it; selecting CUD does not enable unsupported operations.
- Catalog-only APIs are configurable but are documentation, not live routes served by this repository. Their downstream implementations must call the same permission resolver before being exposed.

An empty UserPlatformIds table cannot identify owners in external systems; it never grants company-wide visibility as a fallback.

## Deployment and validation

Restart the backend after deploying. Program.cs applies pending EF migrations on startup, including SeparateReadWriteScopes and PerApiPermissions. No source business data is changed by these schema additions.

Tests cover role defaults, explicit per-API denial, expiry/revocation of legacy grants, modal save/reset, department validation, independent R/CUD scopes, denial before upstream calls, source ownership filtering, and registration of the permission gate on all live controllers. Source-system behavior is tested with local fakes; no writes are issued to real SAP/Zoho by the tests.
