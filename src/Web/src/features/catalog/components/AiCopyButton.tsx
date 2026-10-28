import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/shared/components/IconPicker";
import { Btn } from "@/shared/components/ui";
import { copyText } from "@/shared/components/CopyButton";
import { useToast } from "@/shared/lib/toast";

/** Primary "Copy for AI" button — copies a Markdown brief (endpoint contract + cURL + JSON) to paste into Claude. */
export default function AiCopyButton({
  text,
  label = "Copy for AI",
  size = "sm",
  variant = "primary",
}: {
  text: () => string;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await copyText(text());
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ tone: "danger", message: "Unable to copy. Try again or use Copy cURL." });
    }
  };

  return (
    <Btn
      size={size}
      variant={variant}
      onClick={onClick}
      startIcon={<AppIcon value={copied ? "fa:tick" : "fa:copy"} />}
      title="Copies the API contract, cURL and JSON examples as Markdown — paste it into Claude to write the code"
    >
      {copied ? "Copied — paste into Claude" : label}
    </Btn>
  );
}
