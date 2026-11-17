import { AppIcon } from "./Icon";

const REQUEST_STEPS = ["Draft", "IT preparation", "Development", "Deployment review", "Approved", "Deploy"];
export function ProcessTracker({ step, next, legacy = false, deploymentStatus }: { step: number; next: string; legacy?: boolean; deploymentStatus?: "waiting" | "done" }) {
  const deployed = deploymentStatus === "done";
  return <section className="request-process process-connected" aria-label="Application process"><div className="request-process-heading"><strong>{REQUEST_STEPS[step]}{step === 5 ? deployed ? " · Deployed" : " · Awaiting deployment" : ""}</strong><span>{next}</span></div><ol>{REQUEST_STEPS.map((label, index) => {
    const complete = (index < step && !legacy) || (index === 5 && deployed);
    const status = index === 5 ? deploymentStatus ? deployed ? "Deployed" : "Awaiting deployment" : "After approval" : complete ? "Completed" : index === step ? "In progress" : legacy && index < step ? "Not recorded" : "Pending";
    return <li key={label} className={complete ? "is-complete" : index === step ? "is-current" : ""} aria-current={index === step ? "step" : undefined}><span>{complete ? <AppIcon value="fa:check" /> : String(index + 1).padStart(2, "0")}</span><div className="request-process-label"><strong>{label}</strong><small className="process-step-status">{status}</small></div></li>;
  })}</ol>{legacy && <small>Existing request · Earlier preparation steps were not recorded.</small>}</section>;
}
