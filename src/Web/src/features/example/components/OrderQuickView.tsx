import { AppIcon } from "@/shared/components/Icon";
import { useState } from "react";
import { Dialog, Badge } from "@/shared/components/design-system";
import { Btn } from "@/shared/components/ui";
import { money, total, number, type Order } from "../data";
import { useExample } from "../example-context";

export default function OrderQuickView({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const { go } = useExample();
  return <><Btn size="sm" onClick={() => setOpen(true)}>Preview</Btn><Dialog drawer open={open} title={number(order.id)} onClose={() => setOpen(false)} footer={<Btn variant="primary" onClick={() => go(`orders/${order.id}`)}>Open order details <AppIcon value="fa:external-link"/></Btn>}>
    <div className="workspace-preview"><Badge tone={order.status === "Confirmed" ? "success" : "warning"}>{order.status}</Badge><h3>{order.customer}</h3><p>{order.email}</p><dl><div><dt>Order date</dt><dd>{order.date}</dd></div><div><dt>Line items</dt><dd>{order.lines.length}</dd></div><div><dt>Total (THB)</dt><dd>{money(total(order))}</dd></div></dl><p>{order.note || "No additional notes."}</p></div>
  </Dialog></>;
}
