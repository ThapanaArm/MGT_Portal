import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/shared/components/IconPicker";
import { useToast } from "@/shared/lib/toast";

/**
 * Copies text to the clipboard. navigator.clipboard only exists on HTTPS or localhost,
 * so fall back to a hidden textarea + execCommand when the Portal is opened over plain HTTP on the intranet.
 */
export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(area);
  if (!ok) throw new Error("copy failed");
}

/** Swagger-style copy button: swaps to a check mark for a moment after copying. */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  iconOnly = false,
  className = "",
  title,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  className?: string;
  title?: string;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await copyText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ tone: "danger", message: "Unable to copy. Select the text and copy it manually." });
    }
  };

  const text = copied ? copiedLabel : label;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={iconOnly ? text : undefined}
      className={`copy-button ${copied ? "is-copied" : ""} ${iconOnly ? "is-icon-only" : ""} ${className}`}
    >
      <AppIcon value={copied ? "fa:tick" : "fa:copy"} />
      {!iconOnly && <span>{text}</span>}
      <span className="sr-only" aria-live="polite">{copied ? copiedLabel : ""}</span>
    </button>
  );
}
