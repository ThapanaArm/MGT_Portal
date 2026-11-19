import "./app-showcase.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "@/shared/components/IconPicker";
import { AppAvatar } from "@/shared/components/MediaPickers";
import { AUDIENCE_LABEL, TIER_NAME, appDomain, normalizeTier } from "@/shared/lib/tiers";
import { categoryIcon } from "@/shared/lib/categories";
import type { AppSummaryDto, CategoryDto } from "@/shared/lib/types";

/** Whether the app can be opened from its company domain, and why not when it cannot. */
export function appLaunch(a: AppSummaryDto): { url: string | null; note: string | null } {
  const domain = appDomain(a.subdomain);
  if (!domain) return { url: null, note: "No domain has been assigned yet" };
  if (a.status !== "active") return { url: null, note: a.status === "suspended" ? "This application is suspended" : a.status === "rejected" ? "This request was rejected" : "Available after the request is approved" };
  const url = `https://${domain}`;
  // Approved but IT has not finished deploying: still link it, but say the site may not be up yet.
  return { url, note: a.processStage === "awaiting-deployment" ? "IT is still deploying, so the site may not be ready yet" : null };
}

/** "Open" button that goes to the app's company domain (https://<subdomain>.megachem.co.th). */
export function AppOpenButton({ app, size = "lg" }: { app: AppSummaryDto; size?: "md" | "lg" }) {
  const { url, note } = appLaunch(app);
  return (
    <div className="app-open">
      {url
        ? <a className={`app-open-button ${size === "lg" ? "is-lg" : ""}`} href={url} target="_blank" rel="noopener noreferrer">Open <AppIcon value="fa:external-link" /></a>
        : <span className={`app-open-button is-disabled ${size === "lg" ? "is-lg" : ""}`} aria-disabled="true">Open</span>}
      {note && <small>{note}</small>}
      {url && <small className="app-open-domain">{url.replace("https://", "")}</small>}
    </div>
  );
}

/**
 * What an app page says about the app's state: the chip under the buttons and, when there is
 * something to warn about, the notice beside the title. One map for every page (copy lives here,
 * colours live in app-showcase.css by tone), derived from the workflow state already in the database.
 */
type Tone = "success" | "info" | "warning" | "danger" | "neutral";
interface AppState { label: string; tone: Tone; notice?: string }

export function appState(a: AppSummaryDto): AppState {
  // One short line per state: the chip already names the state, so no long explanation.
  if (a.status === "rejected") return { label: "Rejected", tone: "danger", notice: "Request rejected and closed" };
  if (a.status === "suspended") return { label: "Suspended", tone: "danger", notice: "Suspended, not available to use" };
  if (a.status === "draft") return { label: "Draft", tone: "neutral", notice: "Not submitted yet, not available to use" };
  if (a.status === "pending") return { label: "In review", tone: "info", notice: "In review, not available to use yet" };
  if (!appDomain(a.subdomain)) return { label: "Approved", tone: "success", notice: "No domain yet, not available to use" };
  if (a.processStage === "awaiting-deployment") return { label: "Deploying", tone: "warning", notice: "Preparing for launch, not ready to use yet" };
  if (a.processStage === "deployed") return { label: "Deployed", tone: "info" };
  return { label: "Live", tone: "success" };
}

/** Big logo, name, Open + actions, status chips and (if needed) a notice — the top of an app's page. */
export function AppHero({ app, actions }: { app: AppSummaryDto; actions?: React.ReactNode }) {
  const tier = normalizeTier(app.type);
  const { url } = appLaunch(app);
  const state = appState(app);
  return (
    <header className="app-hero">
      <AppAvatar image={app.image} icon={app.icon} size="xl" />
      <div className="app-hero-body">
        <h1>{app.name}</h1>
        <div className="app-hero-chips">
          <span className={`app-chip is-${state.tone}`} title={state.notice}><i aria-hidden="true" />{state.label}</span>
          {tier && <span className="app-chip is-tier"><AppIcon value="fa:check" />{TIER_NAME[tier]}</span>}
        </div>
        <div className="app-hero-open">
          {url
            ? <a className="app-open-button" href={url} target="_blank" rel="noopener noreferrer">Open <AppIcon value="fa:external-link" /></a>
            : <span className="app-open-button is-disabled" aria-disabled="true" title={state.notice}>Open</span>}
        </div>
      </div>
      {actions && <div className="app-hero-actions">{actions}</div>}
    </header>
  );
}

/**
 * Horizontal row without the browser scrollbar: round previous / next buttons appear on the side
 * that has more to see, and the edges fade so it is clear the row continues.
 */
function ShotsRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.querySelectorAll("img").forEach(img => img.addEventListener("load", update));
    return () => observer.disconnect();
  }, [update, children]);
  const scroll = (direction: 1 | -1) => ref.current?.scrollBy({ left: direction * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className={`app-shots-frame ${edges.start ? "" : "can-back"} ${edges.end ? "" : "can-next"}`}>
      <div ref={ref} className="app-shots" onScroll={update}>{children}</div>
      {!edges.start && <button type="button" className="app-shots-nav is-prev" aria-label="Previous screenshots" onClick={() => scroll(-1)}><AppIcon value="fa:arrow-left" /></button>}
      {!edges.end && <button type="button" className="app-shots-nav is-next" aria-label="More screenshots" onClick={() => scroll(1)}><AppIcon value="fa:arrow-right" /></button>}
    </div>
  );
}

/** Screenshots in a scrolling row; a framed placeholder when the app has none yet. */
export function AppScreenshots({ app, shots, onAdd }: { app: AppSummaryDto; shots: string[]; onAdd?: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="app-section" aria-labelledby="app-shots-title">
      <h2 id="app-shots-title">Screenshots</h2>
      {shots.length ? (
        <ShotsRow>
          {shots.map((src, index) => (
            <button key={index} type="button" className="app-shot" onClick={() => setOpen(index)} aria-label={`View screenshot ${index + 1} of ${shots.length}`}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </ShotsRow>
      ) : (
        <div className="app-shots">
          <div className="app-shot app-shot-placeholder" role="img" aria-label="No screenshots yet">
            <div className="app-shot-browser" aria-hidden="true"><i /><i /><i /><span>{appDomain(app.subdomain) || "your-app.megachem.co.th"}</span></div>
            <div className="app-shot-empty">
              <AppAvatar image={app.image} icon={app.icon} size="lg" />
              <strong>No screenshots yet</strong>
              <span>{onAdd ? "Add screenshots so people can see what the app looks like." : "The owner has not added screenshots for this application."}</span>
              {onAdd && <button type="button" className="app-shot-add" onClick={onAdd}><AppIcon value="fa:upload" /> Add screenshots</button>}
            </div>
          </div>
        </div>
      )}
      {open !== null && shots[open] && <ShotViewer name={app.name} shots={shots} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** About text plus the app's categories (API categories it uses), audience, tier, developer and domain. */
export function AppAbout({ app, categories, title = "About this application" }: { app: AppSummaryDto; categories: CategoryDto[]; title?: string }) {
  const tier = normalizeTier(app.type);
  const domain = appDomain(app.subdomain);
  return (
    <section className="app-section" aria-labelledby="app-about-title">
      <h2 id="app-about-title">{title}</h2>
      <p className="app-about-text">{app.description || "No description provided."}</p>
      <div className="app-about-grid">
        <div>
          <h3>Categories</h3>
          <div className="app-tags">
            {app.products.map((key) => {
              const category = categories.find((c) => c.key === key);
              return <span key={key} className="app-tag"><AppIcon value={categoryIcon(category ?? { key })} /> {category?.name ?? key}</span>;
            })}
            {!app.products.length && <span className="app-tag is-muted"><AppIcon value="fa:box" /> Standalone application</span>}
          </div>
        </div>
        <dl className="app-about-facts">
          <div><dt>Who can use it</dt><dd>{AUDIENCE_LABEL[app.audience] ?? app.audience}</dd></div>
          {tier && <div><dt>Tier</dt><dd>{TIER_NAME[tier]}</dd></div>}
          <div><dt>Developer</dt><dd>{app.ownerDisplayName || app.ownerEmail}</dd></div>
          <div><dt>Domain</dt><dd>{domain ? <code>{domain}</code> : "Not assigned"}</dd></div>
          <div><dt>Last updated</dt><dd>{new Date(app.updatedAt).toLocaleDateString("en-GB")}</dd></div>
        </dl>
      </div>
    </section>
  );
}

/**
 * Full-screen screenshot viewer: the whole picture fits the window (no scrolling inside),
 * arrows on both sides, thumbnails below. Esc closes, left/right arrow keys move.
 */
function ShotViewer({ name, shots, index, onIndex, onClose }: { name: string; shots: string[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const count = shots.length;
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  const go = (step: number) => onIndex((index + step + count) % count);
  return <dialog ref={ref} className="shot-viewer" aria-label={`${name} screenshot ${index + 1} of ${count}`}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={(event) => { if (count > 1 && event.key === "ArrowLeft") go(-1); if (count > 1 && event.key === "ArrowRight") go(1); }}>
    <header className="shot-viewer-bar"><span>{name}</span><span>{index + 1} / {count}</span><button type="button" aria-label="Close" onClick={onClose}><AppIcon value="fa:close" /></button></header>
    <div className="shot-viewer-stage" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      {count > 1 && <button type="button" className="shot-viewer-arrow is-prev" aria-label="Previous screenshot" onClick={() => go(-1)}><AppIcon value="fa:arrow-left" /></button>}
      <img src={shots[index]} alt={`${name} screenshot ${index + 1}`} />
      {count > 1 && <button type="button" className="shot-viewer-arrow is-next" aria-label="Next screenshot" onClick={() => go(1)}><AppIcon value="fa:arrow-right" /></button>}
    </div>
    {count > 1 && <div className="shot-viewer-thumbs">{shots.map((shot, i) => <button key={i} type="button" aria-label={`Screenshot ${i + 1}`} aria-current={i === index || undefined} onClick={() => onIndex(i)}><img src={shot} alt="" /></button>)}</div>}
  </dialog>;
}
