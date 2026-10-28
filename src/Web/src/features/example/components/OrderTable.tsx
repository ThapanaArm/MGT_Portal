import { Btn } from "@/shared/components/ui";
import { DataTable, Badge } from "@/shared/components/design-system";
import { useExample } from "../example-context";
import { money, total, number, type Order } from "../data";
import OrderQuickView from "./OrderQuickView";
export function OrderStatus({value}:{value:string}){return <Badge tone={value==="Confirmed"?"success":value==="Pending confirmation"?"warning":"neutral"}>{value}</Badge>;}
export function OrderActions({order}:{order:Order}){const {edit,deleteOrders}=useExample();return <div className="example-actions"><OrderQuickView order={order}/><Btn size="sm" onClick={()=>edit(order)}>Edit</Btn><Btn size="sm" danger onClick={()=>deleteOrders([order.id])}>Delete</Btn></div>;}
export function OrderTable({records,selectable=false}:{records:Order[];selectable?:boolean}){const {selected,setSelected,go}=useExample();return <DataTable rows={records} rowKey={order=>String(order.id)} selection={selectable?selected.map(String):undefined} onSelectionChange={ids=>setSelected(ids.map(Number))} columns={[{key:"id",title:"Number / Date",render:order=><><button className="example-link" onClick={()=>go(`orders/${order.id}`)}>{number(order.id)}</button><small>{order.date}</small></>},{key:"customer",title:"Customer",render:order=><>{order.customer}<small>{order.email}</small></>},{key:"status",title:"Status",render:order=><OrderStatus value={order.status}/>},{key:"amount",title:"Total (THB)",align:"right",render:order=>money(total(order))},{key:"actions",title:"Manage",render:order=><OrderActions order={order}/>} ]}/>;}
