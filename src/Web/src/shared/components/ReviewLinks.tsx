import { AppIcon } from "@/shared/components/Icon";

/** Supporting links attached to a review (SharePoint, OneDrive, ...). The Portal stores links, not files. */
export default function ReviewLinks({ links }: { links?: string[] | null }) {
  if (!links?.length) return null;
  return <ul className="review-links">{links.map(link => {
    let label = link;
    try { const url = new URL(link); label = `${url.hostname}${decodeURIComponent(url.pathname).replace(/\/$/, "")}`; } catch { /* keep the raw link */ }
    return <li key={link}><a href={link} target="_blank" rel="noopener noreferrer" title={link}><AppIcon value="fa:external-link" /><span>{label}</span></a></li>;
  })}</ul>;
}
