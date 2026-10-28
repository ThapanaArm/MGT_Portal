import { useState } from "react";
import { Avatar, Badge, DataTable, Input, Tree, type TreeNode } from "@/shared/components/design-system";
import { Btn, Panel } from "@/shared/components/ui";
import { useExample } from "../example-context";

export default function OrganizationPage() {
  const { people, go } = useExample();
  const [selected, setSelected] = useState("company");
  const [query, setQuery] = useState("");
  const departments = [...new Set(people.map(person => person.department))];
  const nodes: TreeNode[] = [{ id: "company", label: "Megachem", children: departments.map(department => ({
    id: `department:${department}`, label: department, children: [{
      id: `team:${department}`, label: `${department} team`,
      children: people.filter(person => person.department === department).map(person => ({id: person.id, label: person.name})),
    }],
  })) }];
  const employee = people.find(person => person.id === selected);
  const department = selected.startsWith("department:") || selected.startsWith("team:") ? selected.slice(selected.indexOf(":") + 1) : employee?.department;
  const scope = employee ? [employee] : people.filter(person => !department || person.department === department);
  const rows = scope.filter(person => `${person.name} ${person.email} ${person.role}`.toLowerCase().includes(query.toLowerCase()));
  const title = employee?.name ?? (selected.startsWith("team:") ? `${department} team` : department ?? "Megachem");

  return <div className="example-organization-grid">
    <aside><Panel title="Organization structure" hint="Select a company, department, team, or employee.">
      <Tree nodes={nodes} label="Organization structure" selected={selected} selectBranches onSelect={id => {setSelected(id);setQuery("");}}/>
    </Panel></aside>
    <div><Panel title={title} hint={employee ? "Employee profile" : selected === "company" ? "Company directory" : selected.startsWith("team:") ? "Team directory" : "Department directory"}>
      {employee ? <>
        <div className="example-employee-heading"><Avatar name={employee.name}/><div><strong>{employee.name}</strong><p className="example-muted">{employee.role}</p></div><Badge tone={employee.status === "Active" ? "success" : "neutral"}>{employee.status}</Badge></div>
        <dl className="example-definition"><div><dt>Employee ID</dt><dd>{employee.id}</dd></div><div><dt>Department</dt><dd>{employee.department}</dd></div><div><dt>Team</dt><dd>{employee.department} team</dd></div><div><dt>Email</dt><dd><a href={`mailto:${employee.email}`}>{employee.email}</a></dd></div></dl>
        <Btn onClick={() => setSelected(`team:${employee.department}`)}>View team</Btn>
      </> : <>
        <div className="example-org-summary"><span><strong>{scope.length}</strong> employees</span><span><strong>{selected === "company" ? departments.length : 1}</strong> {selected === "company" ? "departments" : "team"}</span><span><strong>{scope.filter(person => person.status === "Active").length}</strong> active</span></div>
        <Input aria-label="Search organization members" placeholder="Search name, email, or job title..." value={query} onChange={event => setQuery(event.target.value)}/>
        <DataTable rows={rows} rowKey={person => person.id} empty="No matching employees" columns={[
          {key:"name",title:"Employee",render:person=><div className="example-person-cell"><Avatar name={person.name}/><span><button className="example-link" onClick={()=>setSelected(person.id)}>{person.name}</button><small>{person.email}</small></span></div>},
          {key:"department",title:"Department",render:person=><>{person.department}<small>{person.role}</small></>},
          {key:"status",title:"Status",render:person=><Badge tone={person.status==="Active"?"success":"neutral"}>{person.status}</Badge>},
        ]}/>
      </>}
      <div className="example-form-footer"><Btn onClick={()=>go("people")}>Manage employees</Btn></div>
    </Panel></div>
  </div>;
}
