import { FilterToolbar, FilterChipGroup, ActiveFilterChips } from "@/shared/components/filters";
import { BarChart, LineChart, AreaChart, StackedBarChart, ComboChart, HorizontalBarChart, DonutChart, PieChart } from "@/shared/components/charts";
import { AppIcon } from "@/shared/components/IconPicker";
import { SidebarFrame, SidebarItem } from "@/shared/components/Sidebar";
import { useState } from "react";
import { Btn, Panel } from "@/shared/components/ui";
import { Input, Field, Select, Textarea, PasswordInput, FileUpload, OtpInput, Slider, Switch, Tabs, Segmented, Pagination, Stepper, ActionMenu, TableFrame, Stat, Timeline, Tree, Badge, Chip, Avatar, Accordion, Alert, Progress, Skeleton, Dialog, Popover, Tooltip, NavigationBar } from "@/shared/components/design-system";
import { useToast } from "@/shared/lib/toast";
import type { SpecimenType } from "./catalog";

/** The explorer composes the same public primitives used by the example module. */
export default function ComponentSpecimen({type}:{type:SpecimenType}){
 const [dialogSize,setDialogSize]=useState<"sm"|"md"|"lg">("md");
 const [filterValues,setFilterValues]=useState<string[]>(["Draft"]);
 const [value,setValue]=useState("Overview");const [page,setPage]=useState(1);const [range,setRange]=useState(64);const [on,setOn]=useState(true);const [otp,setOtp]=useState("");const [open,setOpen]=useState(false);const [drawer,setDrawer]=useState(false);const [chip,setChip]=useState(true);const toast=useToast();
 let content:React.ReactNode;
 switch(type){
 case "filters":content=<div><FilterToolbar><Input aria-label="Search filter example" placeholder="Search records..."/><FilterChipGroup label="Status" options={[{value:"Draft",label:"Draft",count:4},{value:"Confirmed",label:"Confirmed",count:8}]} values={filterValues} onChange={setFilterValues}/></FilterToolbar><ActiveFilterChips items={filterValues.map(status=>({id:status,label:status,onRemove:()=>setFilterValues(old=>old.filter(item=>item!==status))}))} onClear={()=>setFilterValues([])}/></div>;break;
 case "areachart":content=<AreaChart title="Area chart" description="Illustrative sample data" labels={["Jul","Aug","Sep","Oct"]} series={[{name:"Submitted",values:[12,24,18,32]},{name:"Approved",values:[8,18,14,27]}]} unit="Requests"/>;break;
 case "stackedchart":content=<StackedBarChart title="Stacked bar chart" description="Illustrative sample data" labels={["Jul","Aug","Sep","Oct"]} series={[{name:"Submitted",values:[12,24,18,32]},{name:"Approved",values:[8,18,14,27]}]} unit="Requests"/>;break;
 case "combochart":content=<ComboChart title="Bar and line chart" description="Illustrative sample data" labels={["Jul","Aug","Sep","Oct"]} series={[{name:"Submitted",values:[12,24,18,32]},{name:"Approved",values:[8,18,14,27]}]} unit="Requests"/>;break;
 case "horizontalchart":content=<HorizontalBarChart title="Horizontal bar chart" description="Illustrative sample data" data={[{label:"Sales",value:24},{label:"Finance",value:18},{label:"HR",value:32}]} unit="Requests"/>;break;
 case "donutchart":content=<DonutChart title="Donut chart" description="Illustrative sample data" data={[{label:"Sales",value:24},{label:"Finance",value:18},{label:"HR",value:32}]} unit="Requests"/>;break;
 case "piechart":content=<PieChart title="Pie chart" description="Illustrative sample data" data={[{label:"Sales",value:24},{label:"Finance",value:18},{label:"HR",value:32}]} unit="Requests"/>;break;
 case "barchart":content=<BarChart title="Requests by team" description="Illustrative sample data" labels={["Sales","Finance","HR"]} series={[{name:"Submitted",values:[24,18,32]},{name:"Approved",values:[18,12,27]}]} unit="Requests"/>;break;
 case "linechart":content=<LineChart title="Monthly requests" description="Illustrative sample data" labels={["Jul","Aug","Sep","Oct"]} series={[{name:"Submitted",values:[12,24,18,32]},{name:"Approved",values:[8,18,14,27]}]} unit="Requests"/>;break;
 case "buttons":content=<div className="ds-live-row"><Btn variant="primary" startIcon={<AppIcon value="fa:plus"/>} onClick={()=>toast({tone:"success",message:"Action completed"})}>Create item</Btn><Btn variant="secondary" startIcon={<AppIcon value="fa:check"/>}>Approve</Btn><Btn startIcon={<AppIcon value="fa:rotate"/>}>Refresh</Btn><Btn danger startIcon={<AppIcon value="fa:trash"/>}>Delete item</Btn><Btn iconOnly aria-label="Add item"><AppIcon value="fa:plus"/></Btn></div>;break;
 case "buttonstates":content=<div className="ds-live-row"><Btn size="sm">Small · 32px</Btn><Btn variant="primary">Default · 42px</Btn><Btn disabled>Disabled</Btn><Btn size="lg">Large · 48px</Btn><Btn loading>Saving...</Btn></div>;break;
 case "buttongroup":content=<Segmented label="View" items={["Overview","Table","Cards"]} value={value} onChange={setValue}/>;break;
 case "fields":content=<div className="ds-live-fields"><Field>Project name<Input defaultValue="Customer Portal"/></Field><Field>Status<Select><option>Active</option><option>Draft</option></Select></Field><Field>Description<Textarea placeholder="Additional details"/></Field><Field>Reference code<Input aria-invalid defaultValue="Invalid"/><small>Check the details</small></Field></div>;break;
 case "inputtypes":content=<div className="ds-live-stack"><Field>Search<Input type="search" placeholder="Search items..."/></Field><Field>Password<PasswordInput defaultValue="example123"/></Field><Field>Website<Input type="url" placeholder="https://example.com"/></Field></div>;break;
 case "fileupload":content=<FileUpload label="Choose attachment"/>;break;
 case "datetime":content=<div className="ds-live-fields"><Field>Date<Input type="date" defaultValue="2026-10-19"/></Field><Field>Time<Input type="time" defaultValue="09:30"/></Field></div>;break;
 case "otp":content=<div className="ds-live-stack"><b>Verification code</b><OtpInput value={otp} onChange={setOtp}/><small>Enter the six-digit verification code</small></div>;break;
 case "slider":content=<Slider label="Capacity" value={range} onChange={setRange}/>;break;
 case "selection":content=<div className="ds-live-stack"><label className="ds-live-row"><Input type="checkbox" defaultChecked/>Receive emails</label><label className="ds-live-row"><Input type="radio" name="delivery" defaultChecked/>Standard delivery</label><label className="ds-live-row"><Input type="radio" name="delivery"/>Express delivery</label><Switch label="Automatic updates" checked={on} onChange={setOn}/></div>;break;
 case "tabs":content=<><Tabs items={["Overview","Activity","Settings"]} value={value} onChange={setValue}/><p>{value}</p></>;break;
 case "navbar":content=<div className="ds-live-nav"><NavigationBar><strong>MGT</strong><Btn size="sm">Overview</Btn><Btn size="sm">items</Btn><Avatar name="Sukanya K"/></NavigationBar><SidebarFrame id="ds-example-sidebar" caption="WORKSPACE" collapsed={open} onToggle={()=>setOpen(!open)}><SidebarItem href="/design-system" active label="Overview" onClick={e=>e.preventDefault()}><span><AppIcon value="fa:home"/></span>Overview</SidebarItem><SidebarItem href="/design-system" active={false} label="Data" onClick={e=>e.preventDefault()}><span><AppIcon value="fa:clipboard"/></span>Data</SidebarItem></SidebarFrame></div>;break;
 case "pagination":content=<Pagination page={page} pages={3} total={15} onChange={setPage}/>;break;
 case "stepper":content=<Stepper steps={["Account","Profile","Review"]} current={1}/>;break;
 case "menu":content=<ActionMenu label="Manage item ···" items={[{label:"Duplicate",onClick:()=>toast("Copy created")},{label:"Edit",onClick:()=>toast("Open editor")}]}/>;break;
 case "table":content=<TableFrame><table><thead><tr><th>Name</th><th>Owner</th><th>Status</th></tr></thead><tbody><tr><td>Customer Portal</td><td>Sukanya</td><td><Badge tone="success">Active</Badge></td></tr><tr><td>Sales Dashboard</td><td>Sales team</td><td><Badge tone="warning">Draft</Badge></td></tr></tbody></table></TableFrame>;break;
 case "cards":content=<div className="ds-live-fields"><Panel title="Customer Portal" hint="Updated today"><Badge tone="success">Active</Badge></Panel><Panel title="Sales Dashboard" hint="Sales team"><Badge tone="warning">Draft</Badge></Panel></div>;break;
 case "list":content=<div className="ds-live-stack">{["Design review","Release planning","Customer research"].map(name=><div className="ds-live-row" key={name}><Avatar name={name}/><span>{name}</span><Badge tone="info">Open</Badge></div>)}</div>;break;
 case "stats":content=<div className="ds-live-fields"><Stat label="Active users" value="12,480" hint="+12% this month"/><Stat label="Open issues" value="24" hint="3 items awaiting review"/></div>;break;
 case "timeline":content=<Timeline items={[{title:"Project created",description:"Today · Sukanya"},{title:"Approved",description:"Today · Product team"},{title:"Ready to publish",description:"Tomorrow"}]}/>;break;
 case "tree":content=<Tree groups={[{label:"Product",items:["Customer Portal","Sales Dashboard"]},{label:"Settings",items:["General","Members"]}]} onSelect={name=>toast(name)}/>;break;
 case "badges":content=<div className="ds-live-row"><Badge tone="success">Completed</Badge><Badge tone="info">In progress</Badge><Badge tone="warning">Pending</Badge><Badge tone="danger">Failed</Badge></div>;break;
 case "chips":content=<div className="ds-live-row">{chip&&<Chip onRemove={()=>setChip(false)}>Design</Chip>}<Chip>Active</Chip><Btn size="sm" onClick={()=>setChip(true)}>Add filter</Btn></div>;break;
 case "avatars":content=<div className="ds-live-row"><Avatar name="Sukanya K"/><Avatar name="Product Team"/><Avatar size="sm" name="Sales Team"/></div>;break;
 case "accordion":content=<><Accordion title="What does this component do?" open>Shows additional details without changing pages.</Accordion><Accordion title="Does it support keyboard navigation?">Press Enter or Space to expand and collapse.</Accordion></>;break;
 case "alerts":content=<><Alert tone="success" title="Saved successfully">Your changes have been saved.</Alert><Alert tone="danger" title="Unable to complete the action">Check the details and try again.</Alert></>;break;
 case "toastdemo":content=<div className="ds-live-row">{(["success","info","warning","danger"] as const).map(tone=><Btn key={tone} size="sm" onClick={()=>toast({tone,message:tone==="success"?"The latest changes have been saved.":tone==="danger"?"Unable to save. Please try again.":tone==="warning"?"Complete all required fields before submitting.":"New information is available in your workspace.",duration:6000})}>{tone}</Btn>)}</div>;break;
 case "progress":content=<Progress value={range} label="Progress"/>;break;
 case "skeleton":content=<Skeleton rows={3}/>;break;
 case "overlay":content=<><div className="ds-live-row">{(["sm","md","lg"] as const).map(size=><Btn key={size} onClick={()=>{setDialogSize(size);setOpen(true);}}>{size==="sm"?"Small dialog":size==="md"?"Medium dialog":"Large dialog"}</Btn>)}<Btn onClick={()=>setDrawer(true)}>Open drawer</Btn></div><Dialog size={dialogSize} open={open} title="Dialog size example" onClose={()=>setOpen(false)} footer={<Btn variant="primary" onClick={()=>{setOpen(false);toast({ tone: "success", message: "Success" });}}>Confirm</Btn>}><p>Review the details before continuing.</p></Dialog><Dialog drawer open={drawer} title="Supporting information" onClose={()=>setDrawer(false)}><p>View details without leaving the current page.</p></Dialog></>;break;
 case "popover":content=<div className="ds-live-row"><Tooltip text="More information"><Btn size="sm">?</Btn></Tooltip><Popover label="Visibility"><p>All workspace members can view this information.</p></Popover></div>;break;
 case "layout":content=<Panel title="Page title" hint="Description and related information"><div className="ds-live-fields"><Panel title="Main information"><Input placeholder="Search..."/></Panel><Panel title="Supporting information"><Badge tone="info">Active</Badge></Panel></div></Panel>;break;
 }
 return <div className="specimen ds-live">{content}</div>;
}
