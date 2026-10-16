# MGT Portal — notes for Claude

- Read `README.md` for structure and commands; `docs/database.md` for the schema.
- Backend is one ASP.NET Core project split into modules under `src/Api/MGT.Portal.Api/Modules/<Module>` (Identity, Catalog, Apps, Access). One namespace per module: `MGT.Portal.Api.Modules.<Module>`.
- Allowed module dependencies: Apps → Identity; Access → Identity, Catalog. Identity and Catalog depend on no other module. `tests/MGT.Portal.ArchitectureTests` enforces this — keep it green.
- Entity configuration goes in `Modules/<Module>/Persistence/*Configuration.cs` (picked up by `ApplyConfigurationsFromAssembly`), not in `PortalDbContext`.
- Frontend is plain React 19 + Vite + React Router (no Next.js). Pages live in `src/Web/src/features/<area>/`, routes in `src/Web/src/app/routes.tsx`. Import with the `@/` alias. Never add a frontend route starting with `/api`.
- UI text is Thai first; strings for TH/EN toggle live in `src/Web/src/shared/lib/i18n.ts`.
- Approval rules (Tier 1/2/3, committee votes, IT code review, credential issue/revoke) live only in `Modules/Apps/Services/ApplicationWorkflow.cs`; controllers just call it. `tests/MGT.Portal.UnitTests` covers it.
- Seed data (test passwords) is applied only in Development.
