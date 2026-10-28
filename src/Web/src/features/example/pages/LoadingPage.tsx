import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import LoadingScreen, { type LoadingStep } from "@/shared/components/LoadingScreen";
import { Alert } from "@/shared/components/feedback";
import { Btn } from "@/shared/components/ui";
import { AppIcon } from "@/shared/components/Icon";
import { useExample } from "../example-context";

const STEPS = ["Checking your sign-in", "Loading your workspace", "Preparing the dashboard"];
type Mode = "normal" | "slow" | "error";

/**
 * Full-screen loading example: the MGT Hub mark with a spinning ring, progress steps,
 * a "taking longer than usual" hint, an error state with retry, and a ready state.
 * Try ?state=slow or ?state=error.
 */
export default function LoadingPage() {
  const { go } = useExample();
  const [params, setParams] = useSearchParams();
  const raw = params.get("state");
  const mode: Mode = raw === "slow" || raw === "error" ? raw : "normal";
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const stepMs = mode === "slow" ? 2600 : 1100;
  const failed = mode === "error" && step >= 2;
  const done = !failed && step >= STEPS.length;

  useEffect(() => {
    if (done || failed) return;
    const timer = window.setTimeout(() => setStep((s) => s + 1), stepMs);
    return () => window.clearTimeout(timer);
  }, [step, run, stepMs, done, failed]);

  useEffect(() => {
    if (done || failed) return;
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [run, done, failed]);

  const replay = (next: Mode = mode) => {
    setParams(next === "normal" ? {} : { state: next }, { replace: true });
    setStep(0);
    setElapsed(0);
    setRun((r) => r + 1);
  };

  const steps: LoadingStep[] = STEPS.map((label, i) => ({ label, state: i < step ? "done" : i === step ? "current" : "pending" }));

  return (
    <div className="example-loading-demo">
      {!done && !failed && (
        <LoadingScreen
          key={run}
          fullScreen
          message={STEPS[Math.min(step, STEPS.length - 1)]}
          detail={elapsed >= 4 ? "This is taking longer than usual. Please keep this page open." : "MGT Hub is getting everything ready for you."}
          steps={steps}
        />
      )}

      {failed && (
        <div className="mgt-loading mgt-loading-screen">
          <div className="example-loading-result">
            <Alert tone="danger" title="We could not load your workspace">Check your network connection, then try again. If the problem continues, contact IT support.</Alert>
            <div className="example-actions">
              <Btn variant="primary" startIcon={<AppIcon value="fa:arrow-right" />} onClick={() => replay("normal")}>Try again</Btn>
              <Btn onClick={() => go("help")}>Get help</Btn>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="mgt-loading mgt-loading-screen">
          <div className="example-loading-result">
            <Alert tone="success" title="Your workspace is ready">Everything loaded in {elapsed} seconds.</Alert>
            <div className="example-actions">
              <Btn variant="primary" endIcon={<AppIcon value="fa:arrow-right" />} onClick={() => go("main")}>Open dashboard</Btn>
              <Btn onClick={() => replay()}>Replay</Btn>
            </div>
          </div>
        </div>
      )}

      <nav className="example-loading-controls" aria-label="Loading example controls">
        <span>Example</span>
        <button type="button" aria-pressed={mode === "normal"} onClick={() => replay("normal")}>Normal</button>
        <button type="button" aria-pressed={mode === "slow"} onClick={() => replay("slow")}>Slow network</button>
        <button type="button" aria-pressed={mode === "error"} onClick={() => replay("error")}>Error</button>
      </nav>
    </div>
  );
}
