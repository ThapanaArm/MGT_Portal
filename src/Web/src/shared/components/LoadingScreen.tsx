import { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useId, useState } from "react";
import "./loading-screen.css";

export type LoadingStep = { label: string; state: "done" | "current" | "pending" };

/** MGT Hub app icon (logo A — "Portal"): an arch with the green dot entering it. */
export function HubMark({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0b2038" /><stop offset="1" stopColor="#14426f" /></linearGradient>
        <linearGradient id={`${id}bl`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3a8be6" /><stop offset="1" stopColor="#2368c4" /></linearGradient>
        <linearGradient id={`${id}gr`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9bd25e" /><stop offset="1" stopColor="#78b83e" /></linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${id}bg)`} />
      <path d="M150 404V250a106 106 0 0 1 212 0v154" fill="none" stroke={`url(#${id}bl)`} strokeWidth="64" strokeLinecap="round" />
      <circle className="mgt-loading-dot" cx="256" cy="338" r="44" fill={`url(#${id}gr)`} />
    </svg>
  );
}

/**
 * Loading state from the MGT Design System: the MGT Hub mark inside a spinning ring,
 * a message that says what the system is doing, and optional progress steps.
 * - fullScreen: covers the viewport (app start, route loading). Otherwise it fills its container.
 * - delay: wait this many ms before appearing, so very fast loads do not flash a spinner.
 */
export default function LoadingScreen({
  message = "Loading",
  detail,
  steps,
  fullScreen = false,
  delay = 0,
  children,
}: {
  message?: string;
  detail?: string;
  steps?: LoadingStep[];
  fullScreen?: boolean;
  delay?: number;
  children?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return;
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  if (!visible) return fullScreen ? <div className="mgt-loading-screen mgt-loading-hidden" aria-hidden="true" /> : null;

  return (
    <div className={`mgt-loading ${fullScreen ? "mgt-loading-screen" : ""}`} role="status" aria-live="polite" aria-busy="true">
      <div className="mgt-loading-emblem">
        <svg className="mgt-loading-ring" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle className="mgt-loading-track" cx="60" cy="60" r="54" />
          <circle className="mgt-loading-arc" cx="60" cy="60" r="54" pathLength="100" />
        </svg>
        <HubMark className="mgt-loading-mark" />
      </div>
      <strong className="mgt-loading-message">{message}</strong>
      {detail && <span className="mgt-loading-detail">{detail}</span>}
      {steps && steps.length > 0 && (
        <ol className="mgt-loading-steps">
          {steps.map((step) => (
            <li key={step.label} className={step.state} aria-current={step.state === "current" ? "step" : undefined}>
              <span aria-hidden="true">{step.state === "done" ? <AppIcon value="fa:tick" /> : null}</span>
              {step.label}
            </li>
          ))}
        </ol>
      )}
      {children}
    </div>
  );
}
