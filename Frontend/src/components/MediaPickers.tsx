"use client";

import { useRef } from "react";

const ICON_PALETTE = ["📱", "💳", "📦", "🤖", "📊", "🛠️", "🔔", "📈", "🧾", "🏭", "🚚", "💬", "🔒", "🌐", "🧪", "⚙️"];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AppAvatar({ image, icon, size = "md" }: { image: string | null; icon: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "w-7.5 h-7.5 text-sm rounded-lg" : size === "lg" ? "w-14 h-14 text-2xl rounded-xl" : "w-10 h-10 text-lg rounded-[10px]";
  const pad = size === "sm" ? "p-1" : size === "lg" ? "p-2" : "p-1.5";
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 overflow-hidden border border-line ${dim} ${
        image ? `bg-white ${pad}` : "bg-teal-soft text-teal-strong"
      }`}
    >
      {image ? <img src={image} alt="" className="w-full h-full object-contain" /> : icon}
    </div>
  );
}

export function ImageIconPicker({
  image,
  icon,
  onImageChange,
  onIconChange,
}: {
  image: string | null;
  icon: string;
  onImageChange: (v: string | null) => void;
  onIconChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImageChange(await readAsDataUrl(file));
  };

  return (
    <div className="mb-3.5">
      <label className="text-[12.5px] text-ink-dim font-semibold block mb-1.5">โลโก้ / Icon ของ Application</label>
      <div className="flex items-center gap-3 flex-wrap">
        <AppAvatar image={image} icon={icon} size="lg" />
        <div>
          <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="text-[11.5px] text-ink-dim max-w-[240px]" />
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => {
                onImageChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="text-[12.5px] border border-line-strong rounded-lg px-2.5 py-1.5 hover:bg-surface-2"
            >
              ลบรูป
            </button>
          </div>
        </div>
      </div>
      <div className="text-[12px] text-ink-dim my-2.5">หรือเลือก Icon (ใช้เมื่อไม่มีรูปอัปโหลด)</div>
      <div className="flex flex-wrap gap-1.5">
        {ICON_PALETTE.map((ic) => (
          <button
            key={ic}
            type="button"
            onClick={() => onIconChange(ic)}
            className={`w-8.5 h-8.5 rounded-lg border text-base flex items-center justify-center ${
              ic === icon ? "border-teal bg-teal-soft" : "border-line-strong bg-surface hover:bg-surface-2"
            }`}
          >
            {ic}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShotsPicker({ shots, onChange }: { shots: string[]; onChange: (v: string[]) => void }) {
  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const dataUrls = await Promise.all(files.map(readAsDataUrl));
    onChange([...shots, ...dataUrls]);
    e.target.value = "";
  };

  return (
    <div className="mb-3.5">
      <label className="text-[12.5px] text-ink-dim font-semibold block mb-1.5">Screenshots (เลือกได้หลายรูป)</label>
      <div className="flex flex-wrap gap-2 mb-2.5">
        {shots.length === 0 && <div className="text-[11.5px] text-ink-faint">ยังไม่มี Screenshot — เลือกไฟล์รูปด้านล่างเพื่อเพิ่ม (เลือกได้หลายรูป)</div>}
        {shots.map((s, i) => (
          <div key={i} className="relative w-[84px] h-[84px] rounded-lg overflow-hidden border border-line flex-shrink-0">
            <img src={s} alt="" className="w-full h-full object-cover block" />
            <button
              type="button"
              onClick={() => onChange(shots.filter((_, idx) => idx !== i))}
              className="absolute top-0.5 right-0.5 w-4.5 h-4.5 rounded-full bg-black/55 text-white text-[12px] leading-none flex items-center justify-center hover:bg-black/75"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <input type="file" accept="image/*" multiple onChange={onFiles} className="text-[11.5px] text-ink-dim max-w-[260px]" />
    </div>
  );
}

export function ShotsGallery({ shots }: { shots: string[] }) {
  if (!shots.length) return null;
  return (
    <div className="bg-surface border border-line rounded-[10px] p-[18px] mb-4">
      <h3 className="text-[14px] font-bold mb-3">Screenshots</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {shots.map((s, i) => (
          <img key={i} src={s} alt="" className="h-[170px] w-auto rounded-lg border border-line flex-shrink-0" />
        ))}
      </div>
    </div>
  );
}
