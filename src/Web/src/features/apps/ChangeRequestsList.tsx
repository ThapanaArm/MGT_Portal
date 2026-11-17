import { Badge } from "@/shared/components/design-system";
import ReviewLinks from "@/shared/components/ReviewLinks";
import type { ChangeRequestDto } from "@/shared/lib/types";

/** Every request for changes (IT review and committee), grouped by review round, newest first. */
export default function ChangeRequestsList({ items }: { items: ChangeRequestDto[] }) {
  if (!items.length) return null;
  return <div className="changes-rounds">{[...new Set(items.map(item => item.cycle))].map((cycle, roundIndex) => <section key={cycle} className={roundIndex === 0 ? "changes-round latest" : "changes-round"}>
    <h3>Round {cycle}{roundIndex === 0 && <Badge tone="neutral">Latest change request</Badge>}</h3>
    <ol className="changes-list">{items.filter(item => item.cycle === cycle).map(item => {
      const passed = item.source === "it" && item.resolvedInCycle != null && !!item.resolvedBy && !!item.resolvedAt;
      return <li className={passed ? "resolved" : undefined} key={`${item.source}-${item.by}-${item.at}`}>
      <div className="changes-list-head"><Badge tone={item.source === "it" ? "info" : "neutral"}>{item.source === "it" ? "IT review" : "Committee"}</Badge><strong>{item.by}</strong><small>{new Date(item.at).toLocaleString("en-GB")}</small></div>
      {passed && <><Badge tone="success">IT re-review passed · Round {item.resolvedInCycle}</Badge><p>Passed by {item.resolvedBy} · {new Date(item.resolvedAt!).toLocaleString("en-GB")}. Committee approval is tracked separately below.</p></>}
      {!passed && item.source === "it" && <Badge tone="warning">No recorded re-review pass</Badge>}
      {item.note && <p>{item.note}</p>}
      <ReviewLinks links={item.links} />
    </li>; })}</ol>
  </section>)}</div>;
}
