# User management: existing Users columns

The current implementation stores profile values directly in the existing columns:

| Purpose | Existing storage |
| --- | --- |
| Account identity | Users.Email |
| Password | Users.PasswordHash (BCrypt) |
| Chosen display name / position | Users.DisplayName |
| Organizational level | Users.Level |
| Department | Users.TeamId → Teams |
| Sale group | Users.SaleGroupId → SaleGroups |
| Portal role | Users.RoleId → Roles |

DisplayNameOptions contains the reusable dropdown choices only. Selecting one copies its text to Users.DisplayName; Users does not need an option ID. UserSyncLevelMappings contains the source-role-to-level defaults for new accounts.

## Page

Open **Admin → User management**. Search/filter users, choose their display name and Level, and click **Save** on the row. Choose **+ Add display name...** inside the display-name dropdown to enter a new position in a compact dialog without changing the table row height. **Add and select** saves the reusable choice and selects it in that row; click **Save** on the row to apply it to the user. Cancel keeps the previous selection. Initial choices are Sales Administrative and Human Resources Staff.

No separate level-override field is used. Users.Level is the saved value. Sync applies source levels to newly created users and preserves existing users' saved Level and DisplayName. API permissions remain configured in Access Control.

## Manual sync

There is no scheduled/startup sync. No real sync was run while making this correction.

1. Save/reset profile edits.
2. Select **Sales organization to sync**: **1000** or **2000**, then click **Preview user sync** to read that organization's role counts without changing accounts.
3. Review UserRole mappings; unknown values can be left as Skip.
4. Click **Sync users now** yourself.

The fixed source query reads Email, Password, Department, Division and UserRole from MGT_Datawarehouse.dbo.Ms_User with **WHERE SalesOrganization = @SalesOrganization AND IsActive IN (0, 1)**. Active accounts are imported/updated. Inactive accounts are counted separately in Preview and their matching Portal accounts are deleted during manual Sync; source records are never modified. Inactive passwords are not read. Accounts referenced as application owners, reviewers, voters, or grantors for other users are skipped with a reason so history is preserved; reassign those references before retrying. Missing Portal accounts are not created for inactive rows. NULL status is excluded. The parameter accepts only 1000 or 2000. Preview and Sync must use the same selected organization; changing the selection clears the previous preview. The result and sync audit event include the chosen organization. This filter uses the source column directly and adds no Portal database column. Matching is still by email, so an email shared by both organizations remains one Portal account. ConnectionStrings:Datawarehouse is used when configured, otherwise ConnectionStrings:Default; the identity needs SELECT permission on that source table.

Defaults for new accounts:

- Manager and Leader → management.
- user / employee → employee.
- Admin / Administrator → Administrator Portal role (admin), with management level initially.

Emails are matched without case and surrounding whitespace. Departments/groups are reused by key/name or created when missing. Passwords are hashed before storage and existing matching hashes are retained. Missing/invalid/duplicate source entries are reported as skipped; source passwords and hashes are never returned to the UI or copied into audit snapshots. The supported password input limit is 72 UTF-8 bytes.

Admin source accounts receive the admin role. A previously admin account whose source role is no longer Admin is changed to Employee; other existing non-admin Portal roles are retained. New non-admin users start as Employee with no automatic API scopes. Individual API permissions stay unchanged.

Sync does not delete users absent from the source. Department, sale group and password can be refreshed while existing display names and levels remain set in Portal.

## Session validation without additional columns

A signed JWT includes an HMAC credential stamp derived from the existing PasswordHash and JWT signing key. Each authenticated request checks that stamp and the current RoleId's role key. Password/role changes invalidate old sessions without TokenVersion. Sessions issued before this correction need to sign in again once after backend restart.

## Cleanup for the already-updated database

Migration **20261110130000_SimplifyUserDirectoryColumns** removes these six recently added columns:

- DirectoryLevelOverride
- DirectoryRoleManaged
- DirectorySourceRole
- DisplayNameOptionId
- LastSyncedAt
- TokenVersion

Before dropping them, the migration archives their values per user in AuditLogs with event user.schema_simplified. It fills DisplayName from the selected option only when DisplayName is empty, and fills Level from the former override only when Level is empty. Existing non-empty names/levels, account IDs, password hashes, roles, departments, sale groups and API permissions are preserved.

**db/20261110-simplify-users.sql** is the incremental idempotent correction script for a database where UserDirectoryManagement was already applied. Run the entire script or restart the updated backend to apply the migration. No live schema change or directory sync was performed during this correction.

The earlier db/20261110-user-management.sql is historical and must not be used alone as the final schema. On a fresh installation, apply the full EF migration chain, including this cleanup.


Sale groups are for Sales departments only (Sale, Sales, Sales Department, ฝ่ายขาย, แผนกขาย, ทีมขาย). During manual sync Division is ignored for other departments and Users.SaleGroupId becomes NULL, including previously imported values. Shared SaleGroups rows are retained. No source data is modified. Sales-manager level requires Sales department membership and a division; other levels do not require a sale group.


