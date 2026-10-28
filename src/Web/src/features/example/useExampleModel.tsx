import { englishData } from "./english-data";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useToast } from "@/shared/lib/toast";
import { seed, fresh, number, total, employees, workRequests, type Employee, type WorkRequest, type Order } from "./data";
export function useExampleModel() {

  const { pathname, search } = useLocation(); const navigate = useNavigate(); const toast = useToast();
  useEffect(() => { const previous = document.documentElement.lang; document.documentElement.lang = "en"; return () => { document.documentElement.lang = previous; }; }, []);
  const path = pathname.replace(/^\/design-preview\/?/, "");
  const [orders,setOrders] = useState<Order[]>(() => { try { const saved=englishData(JSON.parse(localStorage.getItem("mgt_ds_example_orders")??"null")); return Array.isArray(saved)&&saved.every((item:Order)=>Number.isFinite(item.id)&&Array.isArray(item.lines)&&typeof item.customer==="string")?saved:seed; } catch { return seed; } });
  const [people,setPeople]=useState<Employee[]>(()=>{try{return englishData(JSON.parse(localStorage.getItem("mgt_ds_example_people")??"null"))??employees;}catch{return employees;}});
  const [requests,setRequests]=useState<WorkRequest[]>(()=>{try{return englishData(JSON.parse(localStorage.getItem("mgt_ds_example_requests")??"null"))??workRequests;}catch{return workRequests;}});
  useEffect(()=>{localStorage.setItem("mgt_ds_example_people",JSON.stringify(people));},[people]);
  useEffect(()=>{localStorage.setItem("mgt_ds_example_requests",JSON.stringify(requests));},[requests]);
  const freshStart=!path||(path==="login"&&new URLSearchParams(search).get("start")==="1");
  const [signedIn,setSignedIn]=useState(()=>freshStart?false:sessionStorage.getItem("mgt_ds_example_session")==="active");
  useEffect(()=>{if(freshStart)sessionStorage.removeItem("mgt_ds_example_session");},[freshStart]);
  const [pendingSignIn,setPendingSignIn]=useState(false);
  const [loginError,setLoginError]=useState("");
  function signIn(email:string,password:string){if(email!=="sales@example.com"||password!=="demo1234"){setLoginError("Incorrect email or password. Please try again.");return;}setLoginError("");completeSignIn();}
  function completeSignIn(){setSignedIn(true);setPendingSignIn(false);sessionStorage.setItem("mgt_ds_example_session","active");navigate("/design-preview/main");toast("Welcome back, Nalin");}
  function logout(){const leave=()=>{setSignedIn(false);setDirty(false);sessionStorage.removeItem("mgt_ds_example_session");setConfirm(null);navigate("/design-preview/login");};if(dirty)setConfirm({title:"Sign out?",message:"Your unsaved changes will be lost.",action:leave});else leave();}
  useEffect(()=>{localStorage.setItem("mgt_ds_example_orders",JSON.stringify(orders));},[orders]); const [query,setQuery] = useState(""); const [filter,setFilter] = useState("All"); const [sort,setSort] = useState("Most recent"); const [page,setPage] = useState(1); const [view,setView] = useState("Table"); const [dataState,setDataState] = useState(new URLSearchParams(search).get("state")==="error"?"error":"loading"); const [selected,setSelected] = useState<number[]>([]);
  const [draft,setDraft] = useState<Order>(() => path.endsWith("/edit") ? (() => { const existing = orders.find(order => order.id === Number(path.split("/")[1])); return existing ? {...existing,lines:existing.lines.map(line=>({...line}))} : fresh(); })() : fresh()); const [error,setError] = useState(""); const [saving,setSaving] = useState(false); const [dirty,setDirty] = useState(false); const [menu,setMenu] = useState(false);
  const [confirm,setConfirm] = useState<{title:string;message:string;action:()=>void;danger?:boolean;tone?:"success"|"info"|"warning"|"danger";confirmLabel?:string}|null>(null);
  const isPublic = ["", "welcome", "login", "verify", "solutions", "contact", "forgot-password", "loading"].includes(path); const isForm = path === "orders/new" || path.endsWith("/edit");
  const orderId = Number(path.split("/")[1]); const record = orders.find(order => order.id === orderId);
  const title = path === "development-flow" ? "Development to deployment" : path === "filters" ? "Filter examples" : path === "charts" ? "Charts" : path === "application-requests" ? "Application requests" : path === "organization" ? "Organization" : path === "main" ? "Dashboard" : path === "people" ? "Employees" : path === "requests" ? "Requests and approvals" : isForm ? (draft.id ? "Edit sales order" : "Create sales order") : path === "settings" ? "Workspace settings" : path === "verify" ? "Verify identity" : path === "help" ? "Help center" : path === "components" ? "Component usage" : path === "orders" ? "Sales orders" : path.startsWith("orders/") ? number(orderId) : "Page not found";
  useEffect(() => { if (dataState!=="loading") return; const timer=setTimeout(()=>setDataState("ready"),800);return()=>clearTimeout(timer); },[dataState]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { window.scrollTo(0, 0); document.title = "MGT Workspace"; }, [pathname]);
  function go(to:string) { setMenu(false); if (dirty && isForm) setConfirm({title:"Leave this form?",message:"Your unsaved changes will be lost.",action:()=>{setDirty(false);navigate(`/design-preview/${to}`);setConfirm(null);}}); else navigate(`/design-preview/${to}`); }
  function edit(order?: Order) { setDraft(order ? {...order,lines:order.lines.map(line=>({...line}))}:fresh());setDirty(false);setError("");navigate(`/design-preview/orders/${order?`${order.id}/edit`:"new"}`); }
  function update(patch: Partial<Order>) {setDraft(old=>({...old,...patch}));setDirty(true);}
  function save(event: React.FormEvent) {event.preventDefault();if(!draft.customer.trim() || !draft.email.trim() || !/^\S+@\S+\.\S+$/.test(draft.email) || !draft.date || draft.lines.some(line=>!line.product.trim() || line.qty<=0 || !Number.isInteger(line.qty) || line.price<=0)){setError("Enter a customer, valid email, date, and items with a quantity and price greater than zero.");return;}setError("");setSaving(true);setTimeout(()=>{const saved={...draft,id:draft.id || Math.max(1023,...orders.map(order=>order.id))+1};setOrders(old=>draft.id?old.map(order=>order.id===draft.id?saved:order):[saved,...old]);setSaving(false);setDirty(false);navigate(`/design-preview/orders/${saved.id}`);toast({ tone: "success", message: "Sales order saved." });},500);}
  function deleteOrders(ids:number[]) {setConfirm({title:`Delete ${ids.length} sales orders?`,message:orders.filter(order=>ids.includes(order.id)).map(order=>number(order.id)).join(", ")+" will be removed from your orders.",danger:true,action:()=>{setOrders(old=>old.filter(order=>!ids.includes(order.id)));setSelected(old=>old.filter(id=>!ids.includes(id)));setConfirm(null);navigate("/design-preview/orders");toast({ tone: "success", message: "Sales orders deleted." });}});}
  const filtered=useMemo(()=>orders.filter(order=>`${number(order.id)} ${order.customer}`.toLowerCase().includes(query.toLowerCase())&&(filter==="All"||order.status===filter)).sort((a,b)=>sort==="Highest total"?total(b)-total(a):b.id-a.id),[orders,query,filter,sort]);
  const pages=Math.max(1,Math.ceil(filtered.length/5)); const current=Math.min(page,pages); const rows=filtered.slice((current-1)*5,current*5);

return {people,setPeople,requests,setRequests,signedIn,pendingSignIn,loginError,signIn,completeSignIn,logout,path,orders,setOrders,query,setQuery,filter,setFilter,sort,setSort,page,setPage,view,setView,dataState,setDataState,selected,setSelected,draft,setDraft,error,setError,saving,dirty,menu,setMenu,confirm,setConfirm,isPublic,isForm,orderId,record,title,go,edit,update,save,deleteOrders,filtered,pages,current,rows,toast,navigate};
}

