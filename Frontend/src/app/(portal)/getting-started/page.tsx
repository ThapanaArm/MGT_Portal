"use client";

import { useRouter } from "next/navigation";
import { Panel, Btn } from "@/components/ui";
import { useLocale } from "@/lib/locale-context";

const STEPS = [
  { title: "Explore API Products", descKey: "gettingStarted.stepExploreDesc" },
  { title: "Register Your App", descKey: "gettingStarted.stepRegisterDesc" },
  { title: "Request API Access", descKey: "gettingStarted.stepRequestDesc" },
  { title: "Get Sandbox Credentials", descKey: "gettingStarted.stepSandboxDesc" },
  { title: "Develop & Test", descKey: "gettingStarted.stepDevelopDesc" },
  { title: "Submit for Review", descKey: "gettingStarted.stepSubmitDesc" },
  { title: "Get Production Access", descKey: "gettingStarted.stepProductionDesc" },
  { title: "Publish Your App", descKey: "gettingStarted.stepPublishDesc" },
];

export default function GettingStartedPage() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <div>
      <div className="mb-4.5">
        <div className="flex items-center gap-2 text-[13.5px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> {t("nav.developerSection")}
        </div>
        <h1 className="text-[26px] font-bold">{t("gettingStarted.heading")}</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[62ch] leading-relaxed">{t("gettingStarted.desc")}</p>
      </div>

      <Panel title="Get Started" hint={t("gettingStarted.panelHint")}>
        <div className="flex flex-col mb-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-4">
              <div className="flex flex-col items-center flex-shrink-0">
                <span className="w-8.5 h-8.5 rounded-full bg-teal-soft text-teal-strong font-mono text-[14.5px] font-bold flex items-center justify-center border border-line flex-shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {i < STEPS.length - 1 && <span className="w-px flex-1 min-h-5 bg-line-strong my-1" />}
              </div>
              <div className="pb-5.5 pt-1">
                <h3 className="text-[16px] font-bold">{s.title}</h3>
                <p className="text-[15px] text-ink-dim mt-1 leading-relaxed max-w-[52ch]">{t(s.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
        <Btn variant="primary" onClick={() => router.push("/my-apps?new=1")}>
          {t("gettingStarted.startBtn")}
        </Btn>
      </Panel>
    </div>
  );
}
