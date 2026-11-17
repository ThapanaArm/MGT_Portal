import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * Turn Font Awesome code copied from fontawesome.com into an icon we can store and render.
 * Accepts HTML (<i class="fa-solid fa-flask"></i>), class names (fa-solid fa-flask, fas fa-flask),
 * React (<FontAwesomeIcon icon={faFlask} />, faFlask, byPrefixAndName.fas['flask']) or just the name (flask).
 * Only the free Solid set is bundled; it is loaded on demand so the main bundle stays small.
 */
export type FaStyle = "solid" | "regular" | "brands" | "pro";
export interface FaCode { style: FaStyle; name?: string; exportName?: string }

const STYLE_TOKENS: Record<string, FaStyle> = {
  "fa-solid": "solid", fas: "solid",
  "fa-regular": "regular", far: "regular",
  "fa-brands": "brands", fab: "brands",
  "fa-light": "pro", fal: "pro", "fa-thin": "pro", fat: "pro", "fa-duotone": "pro", fad: "pro",
  "fa-sharp": "pro", fass: "pro", fasr: "pro", fasl: "pro", fast: "pro", "fa-sharp-duotone": "pro",
  "fa-semibold": "pro", "fa-notdog": "pro", "fa-jelly": "pro", "fa-chisel": "pro", "fa-etch": "pro",
  "fa-slab": "pro", "fa-whiteboard": "pro", "fa-utility": "pro", "fa-thumbprint": "pro",
};

/** Size, animation and layout helpers that are not icon names. */
const MODIFIER = /^fa-(fw|li|ul|border|inverse|spin|spin-pulse|spin-reverse|pulse|beat|beat-fade|bounce|fade|flip|shake|stack|stack-1x|stack-2x|stack-text|layers|layers-text|layers-counter|width-auto|width-fixed|swap-opacity|pull-left|pull-right|pull-start|pull-end|rotate-by|rotate-90|rotate-180|rotate-270|flip-horizontal|flip-vertical|flip-both|2xs|xs|sm|lg|xl|2xl|[1-9]x|10x)$/;

export function parseFontAwesomeCode(input: string): FaCode | null {
  const text = input.trim();
  if (!text) return null;

  // React: icon={faFlask} / import { faFlask } / faFlask
  const exportName = text.match(/\bfa[A-Z0-9][A-Za-z0-9]*\b/)?.[0];
  // React with icon packs: byPrefixAndName.fas['flask']
  const packed = text.match(/\b(fas|far|fab|fal|fat|fad)\s*\[\s*['"]([a-z0-9-]+)['"]\s*\]/);
  if (packed) return { style: STYLE_TOKENS[packed[1]] ?? "solid", name: packed[2] };

  const tokens = text.toLowerCase().match(/\bfa[a-z0-9-]*/g) ?? [];
  let style: FaStyle | undefined;
  let name: string | undefined;
  for (const token of tokens) {
    if (STYLE_TOKENS[token]) { style = style === "pro" ? style : STYLE_TOKENS[token]; continue; }
    if (token.startsWith("fa-") && !MODIFIER.test(token) && !name) name = token.slice(3);
  }
  if (name) return { style: style ?? "solid", name };
  if (exportName) return { style: style ?? "solid", exportName };
  // Plain name such as "flask" or "circle-check"
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(text)) return { style: "solid", name: text.toLowerCase() };
  return null;
}

type SolidPack = Record<string, unknown>;
let solidPack: Promise<SolidPack> | null = null;
const loadSolid = () => (solidPack ??= import("@fortawesome/free-solid-svg-icons") as unknown as Promise<SolidPack>);
const cache = new Map<string, IconDefinition | null>();

const isIcon = (value: unknown): value is IconDefinition =>
  typeof value === "object" && value !== null && "iconName" in value && "icon" in value && "prefix" in value;

/** Find a free Solid icon by name, alias (old FA names such as "search") or React export name (faFlask). */
export async function findSolidIcon(code: { name?: string; exportName?: string }): Promise<IconDefinition | null> {
  const key = code.exportName ?? code.name ?? "";
  if (cache.has(key)) return cache.get(key)!;
  const pack = await loadSolid();
  let found: IconDefinition | null = null;
  if (code.exportName && isIcon(pack[code.exportName])) found = pack[code.exportName] as IconDefinition;
  else if (code.name) {
    const icons = Object.values(pack).filter(isIcon);
    found = icons.find(icon => icon.iconName === code.name)
      ?? icons.find(icon => (icon.icon[2] as (string | number)[]).some(alias => alias === code.name)) ?? null;
  }
  cache.set(key, found);
  if (found) cache.set(found.iconName, found);
  return found;
}

/** Stored value for an icon from the full Solid set (not one of the built-in picker icons). */
export const SOLID_PREFIX = "fa-solid:";

export type FaResolveResult = { ok: true; icon: IconDefinition; note?: string } | { ok: false; error: string };

/** Resolve copied code to a free Solid icon, with a message the picker can show. */
export async function resolveFontAwesomeCode(input: string): Promise<FaResolveResult> {
  const code = parseFontAwesomeCode(input);
  if (!code) return { ok: false, error: "Paste the icon code from fontawesome.com, e.g. <i class=\"fa-solid fa-flask\"></i>." };
  if (code.style === "pro") return { ok: false, error: "This is a Font Awesome Pro icon. Choose an icon marked Free." };
  if (code.style === "brands") return { ok: false, error: "Brand icons (fa-brands) are not available. Choose a Free Solid icon." };
  const icon = await findSolidIcon(code);
  if (!icon) return { ok: false, error: `No free Solid icon named "${code.name ?? code.exportName}". Check the name on fontawesome.com.` };
  return { ok: true, icon, note: code.style === "regular" ? "Regular style is not available, so the Solid version is used." : undefined };
}
