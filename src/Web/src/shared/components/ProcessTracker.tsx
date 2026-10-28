import { AppIcon } from "./Icon";

const REQUEST_STEPS = ["Draft", "IT preparation", "Development", "Deployment review", "Approved"];
export function ProcessTracker({ step, next, legacy = false }: { step: number; next: string; legacy?: boolean }) {
  return <section className="request-process" aria-label="Application process"><div className="request-process-heading"><strong>{REQUEST_STEPS[step]}</strong><span>{next}</span></div><ol>{REQUEST_STEPS.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step && !legacy ? "is-complete" : ""} aria-current={index === step ? "step" : undefined}><span>{index < step && !legacy ? <AppIcon value="fa:check" /> : index + 1}</span><strong>{label}</strong></li>)}</ol>{legacy && <small>Existing request · Earlier preparation steps were not recorded.</small>}</section>;
}
