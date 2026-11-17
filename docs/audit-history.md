# Central audit history and work summary

## Using the page

Open **Admin → Audit & work summary**. Administrators can:

- Filter by local date range, application ID, person, event, and result.
- Open **Change history → View changes** to compare before/after values, changed fields, workflow stages, record keys, and the request reference.
- Open **Work summary** for recorded changes, apps involved, applications created, review actions, deployments, and go-lives by actor.
- Export the currently filtered summary to CSV.

Dates are stored in UTC and displayed in the browser's local timezone. The Through date includes that local day. Reports allow a maximum period of 366 days.

## Storage

The new **dbo.AuditLogs** table stores:

| Fields | Purpose |
| --- | --- |
| Id, BatchId | Audit row and the SaveChanges batch it belongs to |
| OccurredAt | UTC event time |
| ActorUserId, Actor | Stable user ID and actor identity at the time; system for background changes |
| ApplicationId, ApplicationName | Related application and its name when available |
| EntityType, EntityId, EntityKeyJson | Changed record type, available primary key, and logical identifiers such as UserId + ResourceKey |
| EventName, Action, Result | Structured event, entity change action, and outcome |
| PreviousStage, NewStage | Effective workflow stage transitions, including awaiting-deployment, deployed, and live |
| ChangedFieldsJson, BeforeJson, AfterJson | Field-level changes and sanitized old/new values |
| RequestMethod, RequestPath, CorrelationId, StatusCode | Request context and a reference for correlating events/errors |

Related application IDs for newly inserted applications are propagated through EF's relationship tracking. Store-generated primary keys are unavailable before insertion, so EntityId can be null on a creation event; ApplicationId and logical record keys identify that event. Updates/deletions record the known primary key.

## Capture behavior

Production PortalDbContext instances are given IHttpContextAccessor by dependency injection. Each SaveChanges captures supported tracked entity changes, inserts their AuditLogs in the same SaveChanges call, and uses EF's normal transaction/retry behavior. If persistence fails before commit, the success audit is not committed separately. Contexts manually constructed without the accessor retain their existing behavior for isolated tests/design-time use.

Captured changes include applications, screenshots, credentials, reviewer assignments, committee votes, IT code reviews, user/role/team/group information, platform ID mappings, personal tokens, access grants, API permissions, categories/endpoints, and Gateway write metadata. Existing AppLogEntries, AppVotes, AppCodeReviews, and GatewayWriteRecords remain in place.

Known password/token/secret fields and binary images are omitted. Secret JSON property names inside DevelopmentJson are redacted recursively. Repository/link values and catalog request/response examples are omitted. Changed field names remain visible. Free-form notes/descriptions are retained as entered; this is not a general-purpose secret scanner.

Routine personal-token LastUsedAt updates and standalone UpdatedAt changes do not create work events. Existing AppLogEntries are not duplicated as separate audit rows. Structured application stage, reviewer, review verdict, permission, credential, and Gateway event names support reporting without parsing human-readable notes.

Failed/denied HTTP requests are separate metadata-only entries, with no copied headers, body or query string. A valid Gateway personal token is resolved to an actor without storing its raw value. These entries are written in a fresh scope after the operation. If the database is unavailable, failure-audit persistence may also fail; an application error log with the request reference records that condition. This does not provide guaranteed failure capture during a total database outage.

## Integrity and report meaning

Audit records have no public edit/delete endpoints. DbContext rejects audit modifications and deletions. This is application-level append-only protection, not cryptographic tamper evidence or protection against a privileged SQL administrator. The application foreign key uses Restrict, preserving history by preventing physical deletion of applications referenced by audit records; normal suspension/deployment workflows continue to work.

Work counts represent recorded actions, not hours worked, ownership of all project effort, or a performance score. One task may generate several entity changes. Review-action counts include verdict changes and withdrawals. Only Succeeded events contribute to actor work totals. System actions are labelled separately by actor identity.

Historical before/after values cannot be reconstructed from the old generic logs. Detailed history starts after the migration and new backend are active. The old tables remain available for earlier history.

## Installation and verification

Migration **20261110110000_CentralAuditLogs** creates AuditLogs and its time/application/actor/event indexes. Backend startup applies pending migrations. The incremental, idempotent SQL script is **db/20261110-central-audit.sql** (generated after PerApiPermissions); it has been prepared but not applied to the active database in this task.

Tests cover before/after values, actor attribution, application linkage, permission changes, nested secret redaction, effective workflow stages, reviewer removal, noisy timestamp exclusion, append-only enforcement, failed-save cleanup, denied-request metadata, administrator authorization, and summary filters/counts. No production historical data is backfilled.
