import { AppIcon } from "@/shared/components/IconPicker";
import { Btn } from "@/shared/components/ui";
import { useExample } from "../example-context";

export default function WorkspaceWelcome() {
  const { requests, go } = useExample();
  const pending = requests.filter(request => request.status === "Pending approval").length;
  return <section className="workspace-welcome">
    <div><span className="workspace-kicker"><AppIcon value="fa:globe" /> Your workspace, connected</span><h2>Make room for your best work.</h2><p>{pending ? `${pending} requests are waiting for review. Keep your team moving with people, approvals, and sales in one place.` : "You are all caught up. Explore your team's people, approvals, and sales in one place."}</p></div>
    <Btn variant="primary" endIcon={<span><AppIcon value="fa:external-link"/></span>} onClick={() => go(pending ? "requests" : "people")}>{pending ? "Review requests" : "Explore your team"}</Btn>
  </section>;
}
