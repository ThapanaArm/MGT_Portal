import { useEditingGuard } from "@/shared/lib/editing-guard";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Dialog, Field, Input, Select } from "@/shared/components/design-system";
import { Btn } from "@/shared/components/ui";
import { api } from "@/shared/lib/api";
import { useAuth } from "@/shared/lib/auth";
import { useToast } from "@/shared/lib/toast";

type Level = "employee" | "sales_manager" | "manager" | "management";
interface ManagedUser { id: number; email: string; displayName: string; roleKey: string; roleName: string; level: Level; department: string | null; saleGroup: string | null; }
interface NameOption { id: number; name: string; }
interface Draft { name: string; level: Level; }
interface Preview { inactive: number; salesOrganization: string; total: number; roles: { sourceRole: string; users: number; level: Level | null; administrator: boolean; }[]; }
interface SyncResult { deleted: number; salesOrganization: string; total: number; created: number; updated: number; unchanged: number; skipped: number; issues: { email: string; reason: string }[]; requiresSignIn: boolean; }
const LEVELS: { value: Level; label: string }[] = [{ value: "employee", label: "Employee" }, { value: "sales_manager", label: "Sales manager" }, { value: "manager", label: "Department manager" }, { value: "management", label: "Management" }];
const draftOf = (user: ManagedUser): Draft => ({ name: user.displayName, level: user.level });
const changed = (user: ManagedUser, draft?: Draft) => !!draft && (draft.name !== user.displayName || draft.level !== user.level);

export default function AdminUsersPage() {
  const toast = useToast(); const { logout } = useAuth();
  const [salesOrganization, setSalesOrganization] = useState("");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [names, setNames] = useState<NameOption[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null); const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(""); const [level, setLevel] = useState(""); const [needsName, setNeedsName] = useState(false);
  const [nameUserId, setNameUserId] = useState<number | null>(null); const [nameError, setNameError] = useState(""); const [newName, setNewName] = useState(""); const [addingName, setAddingName] = useState(false);
  const [showSync, setShowSync] = useState(false); const [preview, setPreview] = useState<Preview | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({}); const [previewing, setPreviewing] = useState(false); const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const load = async () => {
    const [us, options] = await Promise.all([api.get<ManagedUser[]>("/api/admin/users"), api.get<NameOption[]>("/api/admin/users/display-names")]);
    setUsers(us); setNames(options); setDrafts(Object.fromEntries(us.map(user => [user.id, draftOf(user)])));
  };
  useEffect(() => { let active = true; Promise.all([api.get<ManagedUser[]>("/api/admin/users"), api.get<NameOption[]>("/api/admin/users/display-names")])
    .then(([us, options]) => { if (active) { setUsers(us); setNames(options); setDrafts(Object.fromEntries(us.map(user => [user.id, draftOf(user)]))); } })
    .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load users"); })
    .finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const pending = users.some(user => changed(user, drafts[user.id]));
  const { requestExit } = useEditingGuard(pending);
  const busy = syncing || previewing || saving !== null || addingName;
  const save = async (user: ManagedUser) => {
    setSaving(user.id); setError("");
    try {
      const updated = await api.put<ManagedUser>(`/api/admin/users/${user.id}`, { displayName: drafts[user.id].name, level: drafts[user.id].level });
      setUsers(previous => previous.map(row => row.id === user.id ? updated : row)); setDrafts(previous => ({ ...previous, [user.id]: draftOf(updated) }));
      toast({ tone: "success", message: "User profile saved" }); window.dispatchEvent(new Event("mgt:permissions-updated"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save user"); } finally { setSaving(null); }
  };
  const addName = async () => {
    if (!newName.trim() || nameUserId === null || addingName) return; const userId = nameUserId; setAddingName(true); setNameError("");
    try {
      const option = await api.post<NameOption>("/api/admin/users/display-names", { name: newName.trim() });
      setNames(previous => [...previous.filter(item => item.id !== option.id), option].sort((a, b) => a.name.localeCompare(b.name))); setNewName("");
      setDrafts(previous => ({ ...previous, [userId]: { ...previous[userId], name: option.name } }));
      setNameUserId(null);
      toast({ tone: "success", message: "Display name added and selected. Save the user to apply it." });
    } catch (cause) { setNameError(cause instanceof Error ? cause.message : "Unable to add display name"); } finally { setAddingName(false); }
  };
  const inspectSource = async () => {
    if (!salesOrganization) return;
    setShowSync(true); setPreviewing(true); setError(""); setResult(null);
    try { const value = await api.post<Preview>(`/api/admin/users/sync/preview?salesOrganization=${encodeURIComponent(salesOrganization)}`); setPreview(value); setMappings(Object.fromEntries(value.roles.map(role => [role.sourceRole, role.level ?? ""]))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to read the user directory"); setPreview(null); }
    finally { setPreviewing(false); }
  };
  const sync = async () => {
    if (!preview || pending || preview.salesOrganization !== salesOrganization) return; setSyncing(true); setError("");
    try {
      const value = await api.post<SyncResult>("/api/admin/users/sync", { salesOrganization, levelMappings: preview.roles.filter(role => mappings[role.sourceRole] && role.sourceRole.trim()).map(role => ({ sourceRole: role.sourceRole, level: mappings[role.sourceRole] })) });
      setResult(value);
      if (!value.requiresSignIn) { await load(); window.dispatchEvent(new Event("mgt:permissions-updated")); }
      toast({ tone: "success", message: "User sync completed" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "User sync did not complete"); } finally { setSyncing(false); }
  };
  const departments = [...new Set(users.map(user => user.department).filter((value): value is string => !!value))].sort();
  const visible = users.filter(user => `${user.email} ${user.displayName} ${user.department ?? ""} ${user.saleGroup ?? ""}`.toLowerCase().includes(query.toLowerCase())
    && (!department || user.department === department) && (!level || user.level === level) && (!needsName || !user.displayName.trim()));
  return <div>
    <header className="portal-page-heading"><div className="permission-table-toolbar"><div><h1>User management</h1></div><div className="user-admin-actions"><Btn variant="primary" disabled={busy || pending || nameUserId !== null || loading || !salesOrganization || result?.requiresSignIn} onClick={() => void inspectSource()}>Preview user sync</Btn></div></div></header>
    <section className="user-admin-section"><label htmlFor="sync-sales-organization">Sales organization to sync</label><Select id="sync-sales-organization" disabled={busy || result?.requiresSignIn} value={salesOrganization} onChange={event => { setSalesOrganization(event.target.value); setPreview(null); setMappings({}); setResult(null); }}><option value="">Choose sales organization</option><option value="1000">1000</option><option value="2000">2000</option></Select><p className="permission-note">Preview and sync read only Ms_User records belonging to the selected organization.</p></section>
    {error && <p role="alert" className="mb-5">{error}</p>}
    {showSync && <section className="user-admin-section"><div className="permission-table-toolbar"><h2>Sync from MGT_Datawarehouse / Ms_User</h2><Btn disabled={syncing || previewing} onClick={() => setShowSync(false)}>Close sync panel</Btn></div><p className="permission-note">Email identifies the account. Department updates its department. Division sets a sale group for Sales users only; other departments use no sale group. Passwords are hashed before storage. Existing display names and levels stay as set in Portal. Source levels are used for new accounts.</p>
      {previewing ? <p role="status">Reading source roles...</p> : preview && <><p>Sales organization {preview.salesOrganization} · {preview.total} source users · {preview.inactive} inactive (delete from Portal only; linked users will be skipped)</p><div className="portal-table-frame"><table className="w-full"><thead><tr><th>Source UserRole</th><th>Users</th><th>Level after sync</th><th>Portal role for new users</th></tr></thead><tbody>{preview.roles.map(role => <tr key={role.sourceRole}><td>{role.sourceRole || "Empty value"}</td><td>{role.users}</td><td><Select aria-label={`Level for ${role.sourceRole || "empty source role"}`} disabled={syncing || !role.sourceRole.trim()} value={mappings[role.sourceRole] ?? ""} onChange={event => setMappings(previous => ({ ...previous, [role.sourceRole]: event.target.value }))}><option value="">Skip these users</option>{LEVELS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></td><td>{role.administrator ? "Administrator" : "Employee"}</td></tr>)}</tbody></table></div><p className="permission-note">Admin accounts receive Administrator access. Existing manually assigned Portal roles are preserved for other users.</p><Btn variant="primary" disabled={syncing || pending || !preview.total || preview.salesOrganization !== salesOrganization || result?.requiresSignIn} loading={syncing} onClick={() => void sync()}>{syncing ? "Syncing and hashing passwords..." : "Sync users now"}</Btn></>}
      {result && <div className="user-sync-result" role="status"><strong>Sync completed · Sales organization {result.salesOrganization}</strong><p>{result.deleted} deleted · {result.created} created · {result.updated} updated · {result.unchanged} unchanged · {result.skipped} skipped</p>{result.requiresSignIn && <><p>Your password or role changed during sync. Sign in again to continue.</p><Btn variant="primary" onClick={logout}>Sign in again</Btn></>}{result.issues.length > 0 && <details><summary>View skipped users ({result.issues.length}{result.skipped > result.issues.length ? " shown" : ""})</summary><ul>{result.issues.map((issue, index) => <li key={index}><strong>{issue.email || "Missing email"}</strong>: {issue.reason}</li>)}</ul></details>}</div>}
    </section>}
    {pending && <p role="status" className="mb-4">Save or reset your profile edits before starting a sync.</p>}
    <div className="user-admin-filters"><label>Search<Input placeholder="Name, email, department, or sale group..." value={query} onChange={event => setQuery(event.target.value)} /></label><label>Department<Select value={department} onChange={event => setDepartment(event.target.value)}><option value="">All departments</option>{departments.map(value => <option key={value}>{value}</option>)}</Select></label><label>Level<Select value={level} onChange={event => setLevel(event.target.value)}><option value="">All levels</option>{LEVELS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label><label className="user-checkbox"><input type="checkbox" checked={needsName} onChange={event => setNeedsName(event.target.checked)} />Needs display-name selection</label></div>
    <p className="permission-note mb-4" role="status">{visible.length} of {users.length} users</p>
    {loading ? <p role="status">Loading users...</p> : <div className="portal-table-frame"><table className="w-full user-management-table"><thead><tr>{["Email", "Display name / position", "Department", "Sale group", "Level", "Portal role", "Action"].map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{visible.map(user => <tr key={user.id}>
      <td>{user.email}</td><td><Select aria-label={`Display name for ${user.email}`} disabled={busy || result?.requiresSignIn} value={drafts[user.id]?.name ?? user.displayName} onChange={event => { const value = event.target.value; if (value === "__add_display_name__") { const open = () => { setNameUserId(user.id); setNewName(""); setNameError(""); }; open(); } else setDrafts(previous => ({ ...previous, [user.id]: { ...previous[user.id], name: value } })); }}><option value="">Choose later</option>{user.displayName && !names.some(option => option.name === user.displayName) && <option value={user.displayName}>{user.displayName}</option>}{names.map(option => <option key={option.id} value={option.name}>{option.name}</option>)}<option value="__add_display_name__">+ Add display name...</option></Select>
      </td>
      <td>{user.department ?? "Not assigned"}</td><td>{user.saleGroup ?? "—"}</td><td><Select aria-label={`Level for ${user.email}`} disabled={busy || result?.requiresSignIn} value={drafts[user.id]?.level ?? user.level} onChange={event => setDrafts(previous => ({ ...previous, [user.id]: { ...previous[user.id], level: event.target.value as Level } }))}>{LEVELS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></td><td>{user.roleKey === "admin" ? "Administrator" : user.roleName}</td>
<td><div className="user-row-actions"><Btn size="sm" variant="primary" disabled={busy || !changed(user, drafts[user.id]) || result?.requiresSignIn} loading={saving === user.id} onClick={() => void save(user)}>Save</Btn>{changed(user, drafts[user.id]) && <Btn size="sm" disabled={busy} onClick={() => requestExit(() => setDrafts(previous => ({ ...previous, [user.id]: draftOf(user) })))}>Reset</Btn>}</div></td>
    </tr>)}{!visible.length && <tr><td colSpan={7}>No matching users. Preview a sync to import accounts.</td></tr>}</tbody></table></div>}
    {nameUserId !== null && <Dialog open title="Add display name" size="sm" onClose={() => { if (!addingName) { setNameUserId(null); setNewName(""); setNameError(""); } }}>
      <form onSubmit={event => { event.preventDefault(); void addName(); }}>
        
        <Field>Display name / position<Input autoFocus placeholder="e.g. Sales Administrative" maxLength={160} required disabled={addingName} value={newName} onChange={event => setNewName(event.target.value)} /></Field>
        {nameError && <p role="alert" className="mt-3">{nameError}</p>}
        <div className="user-name-dialog-actions"><Btn type="button" disabled={addingName} onClick={() => { setNameUserId(null); setNewName(""); setNameError(""); }}>Cancel</Btn><Btn type="submit" variant="primary" disabled={addingName || !newName.trim()} loading={addingName}>Add and select</Btn></div>
      </form>
    </Dialog>}
    <p className="permission-note mt-5">Manage API permissions separately in <Link to="/admin/access">Access Control</Link>. Levels and individual API permissions are configured separately.</p>
  </div>;
}







