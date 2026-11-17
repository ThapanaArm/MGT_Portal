import type { DevelopmentRequest } from "@/shared/lib/types";

export default function DeploymentSummary({ state }: { state: DevelopmentRequest | null | undefined }) {
  const date = (value?: string | null) => value ? new Date(value).toLocaleString("en-GB") : "Not recorded";
  return <dl className="release-summary"><div><dt>Version</dt><dd>{state?.version ?? "Initial release"}</dd><small>{state?.branch ?? "—"} · <code>{state?.commit ?? "—"}</code></small></div><div><dt>Deployment</dt><dd>{state?.deployedAt ? date(state.deployedAt) : "Awaiting deployment"}</dd><small>{state?.deployedBy ?? "IT will deploy the approved version"}</small></div><div><dt>Go live</dt><dd>{state?.liveAt ? date(state.liveAt) : "Awaiting go live"}</dd><small>{state?.liveBy ?? "IT will confirm when the release is live"}</small></div></dl>;
}
