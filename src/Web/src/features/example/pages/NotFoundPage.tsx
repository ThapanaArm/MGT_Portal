import { Btn, Panel } from "@/shared/components/ui";
import { useExample } from "../example-context";
export default function NotFoundPage(){const {go}=useExample();return <Panel title="We could not find this page"><p className="example-muted">The page may have moved or the address may be incorrect.</p><Btn variant="primary" onClick={()=>go("")}>Back to home</Btn></Panel>}
