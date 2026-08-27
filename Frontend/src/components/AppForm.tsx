"use client";

import { useState } from "react";
import { ImageIconPicker, ShotsPicker } from "@/components/MediaPickers";
import { Btn, Panel } from "@/components/ui";
import type { CategoryDto } from "@/lib/types";

export interface AppFormValues {
  name: string;
  description: string;
  subdomain: string;
  github: string;
  products: string[];
  image: string | null;
  icon: string;
  screenshots: string[];
}

export default function AppForm({
  title,
  hint,
  initial,
  categories,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  hint: string;
  initial: AppFormValues;
  categories: CategoryDto[];
  submitLabel: string;
  onSubmit: (values: AppFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<AppFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof AppFormValues>(key: K, v: AppFormValues[K]) => setValues((prev) => ({ ...prev, [key]: v }));

  const toggleProduct = (key: string) =>
    setValues((prev) => ({
      ...prev,
      products: prev.products.includes(key) ? prev.products.filter((p) => p !== key) : [...prev.products, key],
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("กรุณากรอกชื่อ Application");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={title} hint={hint}>
      <form onSubmit={submit}>
        <ImageIconPicker image={values.image} icon={values.icon} onImageChange={(v) => set("image", v)} onIconChange={(v) => set("icon", v)} />
        <ShotsPicker shots={values.screenshots} onChange={(v) => set("screenshots", v)} />

        <div className="flex flex-col gap-1.5 mb-2.5">
          <label className="text-[15px] text-ink-dim font-semibold">Application Name</label>
          <input
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="เช่น Warehouse Scanner App"
            className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-[16px]"
          />
        </div>
        <div className="flex flex-col gap-1.5 mb-2.5">
          <label className="text-[15px] text-ink-dim font-semibold">Application Description</label>
          <input
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="อธิบายสั้น ๆ ว่า Application นี้ใช้ทำอะไร"
            className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-[16px]"
          />
        </div>
        <div className="flex flex-col gap-1.5 mb-2.5">
          <label className="text-[15px] text-ink-dim font-semibold">Subdomain</label>
          <input
            value={values.subdomain}
            onChange={(e) => set("subdomain", e.target.value)}
            placeholder="เช่น warehouse-scanner"
            className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-[16px]"
          />
        </div>
        <div className="flex flex-col gap-1.5 mb-3.5">
          <label className="text-[15px] text-ink-dim font-semibold">Link Github</label>
          <input
            value={values.github}
            onChange={(e) => set("github", e.target.value)}
            placeholder="github.com/megachem/your-repo"
            className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-[16px]"
          />
        </div>

        <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">API Products ที่ต้องการใช้งาน</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3.5">
          {categories.map((c) => (
            <label key={c.key} className="flex items-center gap-2 border border-line-strong rounded-lg px-2.5 py-2 text-[15px] cursor-pointer">
              <input type="checkbox" checked={values.products.includes(c.key)} onChange={() => toggleProduct(c.key)} className="accent-teal" />
              {c.name}
            </label>
          ))}
        </div>

        {error && <div className="text-[15px] text-danger bg-danger-soft rounded-lg px-3 py-2 mb-3">{error}</div>}

        <div className="flex gap-2">
          <Btn type="submit" variant="primary" disabled={busy}>
            {busy ? "กำลังบันทึก..." : submitLabel}
          </Btn>
          <Btn type="button" onClick={onCancel}>
            ยกเลิก
          </Btn>
        </div>
      </form>
    </Panel>
  );
}
