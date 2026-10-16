import { useRef, useState } from "react";

const ICON_PALETTE = ["📱", "💳", "📦", "🤖", "📊", "🛠️", "🔔", "📈", "🧾", "🏭", "🚚", "💬", "🔒", "🌐", "🧪", "⚙️"];

// รูปถูกเก็บเป็น data URL ซึ่ง base64 ทำให้ขนาดโตขึ้นราว 33% จึงจำกัดไว้ให้ต่ำกว่า
// เพดานฝั่งเซิร์ฟเวอร์ (50 MB) พอสมควร เพื่อไม่ให้ผู้ใช้เจอ error ตอนกดบันทึก
const MAX_LOGO_MB = 2;
const MAX_SHOT_MB = 4;
const MAX_SHOTS = 8;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** คืนข้อความ error ถ้าไฟล์ใช้ไม่ได้ — คืน null เมื่อผ่าน */
function validateImage(file: File, maxMb: number): string | null {
  if (!file.type.startsWith("image/")) return `“${file.name}” ไม่ใช่ไฟล์รูปภาพ`;
  const mb = file.size / 1024 / 1024;
  if (mb > maxMb) return `“${file.name}” ขนาด ${mb.toFixed(1)} MB — ใหญ่เกิน ${maxMb} MB`;
  return null;
}

function pickImageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []);
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

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 9l5-5 5 5M12 4v12" />
    </svg>
  );
}

/** กรอบสำหรับลากไฟล์มาวาง — จัดการ state ตอนลากผ่านและ error ให้เอง */
function DropZone({
  onFiles,
  children,
  className = "",
}: {
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(pickImageFiles(e.dataTransfer.files));
      }}
      className={`border border-dashed rounded-xl transition-colors ${
        over ? "border-teal bg-teal-soft" : "border-line-strong bg-paper"
      } ${className}`}
    >
      {children}
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
  const [error, setError] = useState<string | null>(null);

  const accept = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const problem = validateImage(file, MAX_LOGO_MB);
    setError(problem);
    if (problem) return;
    onImageChange(await readAsDataUrl(file));
  };

  const clear = () => {
    onImageChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mb-3.5">
      <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">โลโก้ / Icon ของ Application</label>

      <DropZone onFiles={accept} className="p-3.5">
        <div className="flex items-center gap-3.5 flex-wrap">
          <AppAvatar image={image} icon={icon} size="lg" />
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 border border-line-strong bg-surface rounded-lg px-3 py-1.5 text-[14.5px] font-semibold hover:bg-surface-2"
              >
                <UploadIcon />
                {image ? "เปลี่ยนรูป" : "เลือกไฟล์รูป"}
              </button>
              {image && (
                <button
                  type="button"
                  onClick={clear}
                  className="border border-line-strong rounded-lg px-3 py-1.5 text-[14.5px] text-danger hover:bg-danger-soft"
                >
                  ลบรูป
                </button>
              )}
            </div>
            <div className="text-[13px] text-ink-faint mt-1.5">
              ลากไฟล์มาวางตรงนี้ได้ · PNG, JPG, SVG · ไม่เกิน {MAX_LOGO_MB} MB
            </div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => accept(pickImageFiles(e.target.files))}
          className="hidden"
        />
      </DropZone>

      {error && <div className="text-[13.5px] text-danger bg-danger-soft rounded-lg px-3 py-2 mt-2">{error}</div>}

      <div className="text-[14.5px] text-ink-dim mt-3 mb-2">หรือเลือก Icon (ใช้เมื่อไม่มีรูปอัปโหลด)</div>
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = async (files: File[]) => {
    if (!files.length) return;

    const room = MAX_SHOTS - shots.length;
    if (room <= 0) {
      setError(`เพิ่มได้สูงสุด ${MAX_SHOTS} รูป — ลบรูปเดิมออกก่อน`);
      return;
    }

    const problems: string[] = [];
    const ok: File[] = [];
    for (const f of files) {
      const problem = validateImage(f, MAX_SHOT_MB);
      if (problem) problems.push(problem);
      else ok.push(f);
    }

    const accepted = ok.slice(0, room);
    if (ok.length > room) problems.push(`เพิ่มได้อีก ${room} รูปเท่านั้น (สูงสุด ${MAX_SHOTS} รูป)`);

    setError(problems.length ? problems.join(" · ") : null);
    if (accepted.length) onChange([...shots, ...(await Promise.all(accepted.map(readAsDataUrl)))]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mb-3.5">
      <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">
        Screenshots <span className="text-ink-faint font-normal">({shots.length}/{MAX_SHOTS})</span>
      </label>

      <DropZone onFiles={accept} className="p-3.5">
        <div className="flex flex-wrap gap-2">
          {shots.map((s, i) => (
            <div key={i} className="relative w-[84px] h-[84px] rounded-lg overflow-hidden border border-line flex-shrink-0 bg-white">
              <img src={s} alt="" className="w-full h-full object-cover block" />
              <button
                type="button"
                onClick={() => onChange(shots.filter((_, idx) => idx !== i))}
                aria-label="ลบรูปนี้"
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/55 text-white text-[15px] leading-none flex items-center justify-center hover:bg-black/75"
              >
                ×
              </button>
            </div>
          ))}

          {shots.length < MAX_SHOTS && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-[84px] h-[84px] rounded-lg border border-dashed border-line-strong bg-surface hover:bg-surface-2 flex flex-col items-center justify-center gap-1 text-ink-dim flex-shrink-0"
            >
              <UploadIcon />
              <span className="text-[12.5px] font-semibold">เพิ่มรูป</span>
            </button>
          )}
        </div>

        <div className="text-[13px] text-ink-faint mt-2.5">
          ลากไฟล์มาวางตรงนี้ได้ · เลือกพร้อมกันหลายรูปได้ · รูปละไม่เกิน {MAX_SHOT_MB} MB
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => accept(pickImageFiles(e.target.files))}
          className="hidden"
        />
      </DropZone>

      {error && <div className="text-[13.5px] text-danger bg-danger-soft rounded-lg px-3 py-2 mt-2">{error}</div>}
    </div>
  );
}

export function ShotsGallery({ shots }: { shots: string[] }) {
  if (!shots.length) return null;
  return (
    <div className="bg-surface border border-line rounded-[10px] p-[18px] mb-4">
      <h3 className="text-[16.5px] font-bold mb-3">Screenshots</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {shots.map((s, i) => (
          <img key={i} src={s} alt="" className="h-[170px] w-auto rounded-lg border border-line flex-shrink-0" />
        ))}
      </div>
    </div>
  );
}
