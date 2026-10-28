import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { resolveIcon } from "./icon-catalog";

/** Render legacy icon IDs with Font Awesome without changing database content. */
export function AppIcon({ value, className = "" }: { value: string; className?: string }) {
  return <FontAwesomeIcon icon={resolveIcon(value)} aria-hidden="true" className={`mgt-icon ${className}`} />;
}