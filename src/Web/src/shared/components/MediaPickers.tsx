import { useRef, useState } from "react";
import IconPicker, { AppIcon } from "./IconPicker";


// Images use data URLs. Allow headroom for base64 overhead below the server upload limit.
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

/** Return an error for invalid files, otherwise null. */
function validateImage(file: File, maxMb: number): string | null {
  if (!file.type.startsWith("image/")) return `“${file.name}” is not an image file`;
  const mb = file.size / 1024 / 1024;
  if (mb > maxMb) return `“${file.name}” size ${mb.toFixed(1)} MB — exceeds the limit of ${maxMb} MB`;
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
      {image ? <img src={image} alt="" className="w-full h-full object-contain" /> : <AppIcon value={icon} />}
    </div>
  );
}

function UploadIcon() {
  return (
    <AppIcon value="fa:upload" className="w-5 h-5"/>
  );
}

/** Drop zone with drag state and validation feedback. */
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
      <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Application logo or icon</label>

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
                {image ? "Change image" : "Choose image"}
              </button>
              {image && (
                <button
                  type="button"
                  onClick={clear}
                  className="border border-line-strong rounded-lg px-3 py-1.5 text-[14.5px] text-danger hover:bg-danger-soft"
                >
                  Remove image
                </button>
              )}
            </div>
            <div className="text-[13px] text-ink-faint mt-1.5">
              Drag images here · PNG, JPG, SVG · Maximum {MAX_LOGO_MB} MB
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

      <div className="text-[14.5px] text-ink-dim mt-3 mb-2">Or choose an icon (used when no image is uploaded)</div>
      <IconPicker value={icon} onChange={onIconChange} />
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
      setError(`Maximum images: ${MAX_SHOTS} images. Remove an existing image first.`);
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
    if (ok.length > room) problems.push(`You can add ${room} more images (maximum ${MAX_SHOTS} images)`);

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
                aria-label="Remove this image"
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/55 text-white text-[15px] leading-none flex items-center justify-center hover:bg-black/75"
              >
                <AppIcon value="fa:close"/>
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
              <span className="text-[12.5px] font-semibold">Add image</span>
            </button>
          )}
        </div>

        <div className="text-[13px] text-ink-faint mt-2.5">
          Drag images here · Multiple selection supported · Maximum per image: {MAX_SHOT_MB} MB
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
