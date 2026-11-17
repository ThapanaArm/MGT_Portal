import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { resolveIcon } from "./icon-catalog";
import { SOLID_PREFIX, findSolidIcon } from "./fa-code";

/** Render legacy icon IDs with Font Awesome without changing database content. */
export function AppIcon({ value, className = "" }: { value: string; className?: string }) {
  if (value.startsWith(SOLID_PREFIX)) return <SolidIcon name={value.slice(SOLID_PREFIX.length)} className={className} />;
  return <FontAwesomeIcon icon={resolveIcon(value)} aria-hidden="true" className={`mgt-icon ${className}`} />;
}

/** Any free Solid icon pasted from fontawesome.com ("fa-solid:<name>") — the icon set loads on first use. */
function SolidIcon({ name, className }: { name: string; className: string }) {
  const [icon, setIcon] = useState<IconDefinition | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    setIcon(undefined);
    findSolidIcon({ name }).then(found => { if (active) setIcon(found); }).catch(() => { if (active) setIcon(null); });
    return () => { active = false; };
  }, [name]);
  // Keep the same footprint while loading so layouts do not jump.
  if (icon === undefined) return <span aria-hidden="true" className={`mgt-icon svg-inline--fa ${className}`} style={{ display: "inline-block", width: "1em", height: "1em" }} />;
  return <FontAwesomeIcon icon={icon ?? resolveIcon("fa:box")} aria-hidden="true" className={`mgt-icon ${className}`} />;
}
