import { useEditingGuard } from "@/shared/lib/editing-guard";
import { Dialog, Input, Select } from "@/shared/components/design-system";
import { useEffect, useState } from "react";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn } from "@/shared/components/ui";
import type { TeamDto, UserBriefDto } from "@/shared/lib/types";

type PermissionScope = "none" | "self" | "team" | "all" | "salegroup";
interface PermissionRow {
  resourceKey: string; categoryKey: string; categoryName: string; name: string; endpoints: string[];
  readScope: PermissionScope; writeScope: PermissionScope; defaultReadScope: PermissionScope; defaultWriteScope: PermissionScope; isCustom: boolean;
}
interface PermissionDocument { userId: number; teamId: number | null; permissions: PermissionRow[]; }
const OPTIONS = [{ value: "none", label: "No access" }, { value: "self", label: "Own data" }, { value: "team", label: "Department data" }, { value: "all", label: "Company data" }];
const hasAccess = (row: PermissionRow) => row.readScope !== "none" || row.writeScope !== "none";
const accessLevel = (row: PermissionRow) => row.writeScope === "none" ? "read" : row.readScope === "none" ? "change" : "both";
const ACCESS_LABELS: Record<string, string> = { read: "Read only", change: "Changes only", both: "Read and change" };
const matches = (row: PermissionRow, search: string) => `${row.categoryName} ${row.name} ${row.resourceKey} ${row.endpoints.join(" ")}`.toLowerCase().includes(search.toLowerCase());

export default function UserScopeTable() {
  const toast = useToast();
  const [users, setUsers] = useState<UserBriefDto[]>([]);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [selected, setSelected] = useState<UserBriefDto | null>(null);
  const [document, setDocument] = useState<PermissionDocument | null>(null);
  const [original, setOriginal] = useState<PermissionDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [removing, setRemoving] = useState<PermissionRow | null>(null);
  const dirty = !!document && JSON.stringify(document) !== JSON.stringify(original);
  const { requestExit } = useEditingGuard(dirty || saving);

  useEffect(() => {
    let active = true;
    Promise.all([api.get<UserBriefDto[]>("/api/access/users"), api.get<TeamDto[]>("/api/access/teams")])
      .then(([us, ts]) => { if (active) { setUsers(us); setTeams(ts); } })
      .catch(() => { if (active) setError("Unable to load users. Refresh the page to try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    api.get<PermissionDocument>(`/api/access/users/${selected.id}/api-permissions`)
      .then(value => {
        if (!active) return;
        setDocument(value);
        setOriginal(value);
        setAdding(value.permissions.length > 0 && !value.permissions.some(hasAccess));
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load API permissions."); });
    return () => { active = false; };
  }, [selected]);


  const open = (user: UserBriefDto) => { setDocument(null); setOriginal(null); setError(""); setQuery(""); setLevelFilter(""); setCategoryFilter(""); setAddQuery(""); setAdding(false); setSelected(user); window.scrollTo({ top: 0 }); };
  const close = () => { if (!saving) { setSelected(null); setDocument(null); setOriginal(null); setError(""); } };
  const patch = (key: string, change: Partial<PermissionRow>) => setDocument(previous => previous && ({ ...previous, permissions: previous.permissions.map(row => row.resourceKey === key ? { ...row, ...change } : row) }));
  const save = async () => {
    if (!selected || !document) return;
    if (!document.teamId && document.permissions.some(row => row.isCustom && (row.readScope === "team" || row.writeScope === "team"))) {
      setError("Select a department to allow access to department data."); return;
    }
    setSaving(true); setError("");
    try {
      const updated = await api.put<PermissionDocument>(`/api/access/users/${selected.id}/api-permissions`, {
        teamId: document.teamId, permissions: document.permissions.map(({ resourceKey, readScope, writeScope, isCustom }) => ({ resourceKey, readScope, writeScope, isCustom })),
      });
      setUsers(previous => previous.map(user => user.id === selected.id ? { ...user, teamId: updated.teamId, teamName: teams.find(team => team.id === updated.teamId)?.name ?? null } : user));
      setDocument(updated); setOriginal(updated);
      window.dispatchEvent(new Event("mgt:permissions-updated"));
      toast({ tone: "success", message: "Permissions saved" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save permissions. Try again."); }
    finally { setSaving(false); }
  };

  if (!selected) return <div>
    <header className="portal-page-heading"><span className="workspace-kicker">Admin</span><h1>Access Control</h1><p className="text-ink-dim mt-2">Choose a person to see which APIs they can use and what they can do.</p></header>
    <div className="mb-5"><Input aria-label="Find a user" placeholder="Search by name, email, or department..." value={userQuery} onChange={event => setUserQuery(event.target.value)} /></div>
    {error && <p role="alert" className="mb-3">{error}</p>}
    <div className="portal-table-frame"><table className="w-full"><thead><tr>{["User", "Role", "Department", ""].map((label, index) => <th key={index} scope="col">{label}</th>)}</tr></thead><tbody>
      {users.filter(user => `${user.displayName} ${user.email} ${user.teamName ?? ""}`.toLowerCase().includes(userQuery.toLowerCase())).map(user => <tr key={user.id}><td><strong>{user.displayName}</strong><span className="block text-[12px] text-ink-dim">{user.email}</span></td><td>{user.roleName}</td><td>{user.teamName ?? "Not assigned"}</td><td><Btn size="sm" onClick={() => open(user)} aria-label={`View permissions for ${user.displayName}`}>View permissions</Btn></td></tr>)}
      {!users.some(user => `${user.displayName} ${user.email} ${user.teamName ?? ""}`.toLowerCase().includes(userQuery.toLowerCase())) && <tr><td colSpan={4}>{loading ? "Loading users..." : "No matching users"}</td></tr>}
    </tbody></table></div>
  </div>;

  const assigned = document?.permissions.filter(hasAccess) ?? [];
  const categories = Array.from(new Map(assigned.map(row => [row.categoryKey, row.categoryName])).entries());
  const rows = assigned.filter(row => matches(row, query) && (!levelFilter || accessLevel(row) === levelFilter) && (!categoryFilter || row.categoryKey === categoryFilter));
  const available = document?.permissions.filter(row => !hasAccess(row)) ?? [];
  const availableRows = available.filter(row => matches(row, addQuery));
  const togglePicker = () => {
    setAdding(value => !value);
    setAddQuery("");
  };

  return <div className="permission-page">
    <header className="portal-page-heading">
      <Btn type="button" variant="ghost" disabled={saving} onClick={() => requestExit(close)}>Back to users</Btn>
      <div className="permission-page-title">
        <div>
          <h1>{selected.displayName}</h1>
          <p className="text-ink-dim mt-2">{selected.email} &middot; {selected.roleName}</p>
        </div>
        {document && <label className="permission-department" htmlFor="permission-department">
          <span>Department</span>
          <Select id="permission-department" value={document.teamId ?? ""} disabled={saving} onChange={event => {
            const teamId = event.target.value ? Number(event.target.value) : null;
            setDocument(previous => previous && ({ ...previous, teamId }));
          }}>
            <option value="">Not assigned</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
        </label>}
      </div>
    </header>
    {error && <p role="alert" className="mb-5">{error}</p>}
    {!document ? <p role={error ? undefined : "status"}>{error ? "Return to the user list and try again." : "Loading permissions..."}</p> : <>
      <section className="permission-page-content" aria-labelledby="permission-heading">
        <div className="permission-table-toolbar">
          <h2 id="permission-heading">API Access</h2>
          {(available.length > 0 || adding) && (assigned.length > 0 || adding) && <Btn
            type="button" variant={adding ? "ghost" : "primary"} disabled={saving}
            aria-expanded={adding} aria-controls={adding ? "available-api-picker" : undefined} onClick={togglePicker}
          >{adding ? "Close API list" : "Grant API access"}</Btn>}
        </div>
        {!assigned.length && <div className="permission-empty">
          <p>No API access yet</p>
          {!adding && available.length > 0 && <Btn type="button" variant="primary" disabled={saving} onClick={togglePicker}>Grant API access</Btn>}
          {!available.length && <p className="permission-note">There are no APIs in the catalog.</p>}
        </div>}
        {adding && <section id="available-api-picker" className="permission-api-picker" aria-label="Available APIs"><h3>Available APIs</h3><p className="permission-note">Select Add to give this person access to view their own data. Changes apply when you save.</p><Input aria-label="Search available APIs" placeholder="Search available APIs..." value={addQuery} onChange={event => setAddQuery(event.target.value)} /><div className="permission-matrix"><table className="w-full"><thead><tr><th>Category</th><th>API</th><th></th></tr></thead><tbody>{availableRows.map(row => <tr key={row.resourceKey}><td>{row.categoryName}</td><td><strong>{row.name}</strong></td><td><Btn type="button" size="sm" disabled={saving} aria-label={`Add ${row.name}`} onClick={() => { patch(row.resourceKey, { readScope: "self", writeScope: "none", isCustom: true }); setQuery(""); setCategoryFilter(""); setLevelFilter(""); }}>Add</Btn></td></tr>)}{!availableRows.length && <tr><td colSpan={3}>{available.length ? "No matching APIs" : assigned.length ? "All APIs are already assigned" : "There are no APIs in the catalog"}</td></tr>}</tbody></table></div></section>}
        {assigned.length > 0 && <>
          <div className="permission-list-filters">
            <label><span>Search APIs</span><Input placeholder="Search this person's APIs..." value={query} onChange={event => setQuery(event.target.value)} /></label>
            <label><span>Category</span><Select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</Select></label>
            <label><span>Access level</span><Select value={levelFilter} onChange={event => setLevelFilter(event.target.value)}><option value="">All access levels</option>{Object.entries(ACCESS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label>
            {(query || categoryFilter || levelFilter) && <Btn type="button" variant="ghost" onClick={() => { setQuery(""); setCategoryFilter(""); setLevelFilter(""); }}>Clear filters</Btn>}
          </div>
          <p className="sr-only" role="status">Showing {rows.length} of {assigned.length} assigned APIs</p>
          <div className="permission-matrix permission-assigned"><table className="w-full"><thead><tr><th scope="col">API</th><th scope="col">Can view data</th><th scope="col">Can change data</th><th scope="col">Action</th></tr></thead><tbody>{rows.map(row => <tr key={row.resourceKey}>
            <td><span className="block text-[12px] text-ink-dim">{row.categoryName}</span><strong>{row.name}</strong><details className="permission-routes"><summary>Details</summary><span className="block mt-2">{row.isCustom ? "Set for this person" : "Inherited from role and active grants"}</span>{row.endpoints.map(path => <code key={path}>{path}</code>)}{row.isCustom && <button type="button" className="permission-reset" disabled={saving} onClick={() => patch(row.resourceKey, { readScope: row.defaultReadScope, writeScope: row.defaultWriteScope, isCustom: false })}>Restore role permissions</button>}</details></td>
            {(["readScope", "writeScope"] as const).map(key => <td key={key}><Select aria-label={`${key === "readScope" ? "View" : "Change"} data for ${row.name}`} value={row[key]} disabled={saving} onChange={event => patch(row.resourceKey, { [key]: event.target.value, isCustom: true })}>{OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}{row[key] === "salegroup" && <option value="salegroup">Sale group (existing)</option>}</Select></td>)}
            <td><Btn type="button" size="sm" danger disabled={saving} aria-label={`Remove access to ${row.name}`} onClick={() => setRemoving(row)}>Remove access</Btn></td>
          </tr>)}{!rows.length && <tr><td colSpan={4}>No APIs match these filters.</td></tr>}</tbody></table></div>
        </>}
      </section>
      {dirty && <footer className="permission-page-actions">
        <span role="status">{saving ? "Saving changes..." : "Unsaved changes"}</span>
        <div>
          <Btn type="button" disabled={saving} onClick={() => { setDocument(original); setError(""); }}>Discard changes</Btn>
          <Btn type="button" variant="primary" disabled={saving} loading={saving} onClick={() => void save()}>Save changes</Btn>
        </div>
      </footer>}
      {removing && <Dialog open confirmation title="Remove API access?" onClose={() => setRemoving(null)}
        footer={<>
          <Btn type="button" autoFocus onClick={() => setRemoving(null)}>Cancel</Btn>
          <Btn type="button" danger onClick={() => {
            patch(removing.resourceKey, { readScope: "none", writeScope: "none", isCustom: true });
            setRemoving(null);
          }}>Remove access</Btn>
        </>}>
        <p>When you save, this person will lose all access to {removing.name}, including any access inherited from their role or active grants.</p>
      </Dialog>}
    </>}
  </div>;
}
