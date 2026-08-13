"use client";

import { useRouter } from "next/navigation";
import { Panel, Btn } from "@/components/ui";

const STEPS = [
  { title: "Explore API Products", desc: "ค้นหาและเลือก API ที่เหมาะกับ Application ของคุณ" },
  { title: "Register Your App", desc: "ลงทะเบียน Application และข้อมูลผู้รับผิดชอบ" },
  { title: "Request API Access", desc: "เลือก API และขอสิทธิ์สำหรับ Development" },
  { title: "Get Sandbox Credentials", desc: "รับ Token ID และ Token Secret สำหรับทดสอบ" },
  { title: "Develop & Test", desc: "พัฒนา Integration และทดสอบ Application" },
  { title: "Submit for Review", desc: "ส่ง Application เพื่อตรวจสอบความพร้อม" },
  { title: "Get Production Access", desc: "ผ่านการอนุมัติและรับ Production Credential" },
  { title: "Publish Your App", desc: "เผยแพร่ Application บน MGT App" },
];

export default function GettingStartedPage() {
  const router = useRouter();

  return (
    <div>
      <div className="mb-4.5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-faint font-bold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-teal" /> นักพัฒนา
        </div>
        <h1 className="text-[22px] font-bold">สนใจ API เริ่มยังไง?</h1>
        <p className="text-ink-dim text-[13.5px] mt-1.5 max-w-[62ch] leading-relaxed">
          ทำตามขั้นตอนด้านล่างเพื่อเริ่มพัฒนาและเชื่อมต่อกับ Megachem API ตั้งแต่สำรวจ API ไปจนถึงเผยแพร่
          Application จริง
        </p>
      </div>

      <Panel title="Get Started" hint="8 ขั้นตอนสู่การใช้งาน API แบบ Production">
        <div className="flex flex-col mb-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-4">
              <div className="flex flex-col items-center flex-shrink-0">
                <span className="w-8.5 h-8.5 rounded-full bg-teal-soft text-teal-strong font-mono text-[12px] font-bold flex items-center justify-center border border-line flex-shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {i < STEPS.length - 1 && <span className="w-px flex-1 min-h-5 bg-line-strong my-1" />}
              </div>
              <div className="pb-5.5 pt-1">
                <h3 className="text-[13.5px] font-bold">{s.title}</h3>
                <p className="text-[12.5px] text-ink-dim mt-1 leading-relaxed max-w-[52ch]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Btn variant="primary" onClick={() => router.push("/my-apps?new=1")}>
          เริ่มลงทะเบียน App
        </Btn>
      </Panel>
    </div>
  );
}
