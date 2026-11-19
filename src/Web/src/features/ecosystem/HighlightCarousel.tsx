import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { AppIcon } from "@/shared/components/IconPicker";
import { TypeChip } from "@/shared/components/ui";
import { api } from "@/shared/lib/api";
import type { AppDetailDto, AppSummaryDto } from "@/shared/lib/types";
import "./highlight-carousel.css";

/**
 * Ecosystem Highlights: the selected app is a large card in the middle, its neighbours sit smaller on each side.
 * Click a side card, an arrow or a dot to bring that app to the middle.
 */
export default function HighlightCarousel({ apps, label, categoryName }: { apps: AppSummaryDto[]; label: string; categoryName: (key: string) => string }) {
  const [index, setIndex] = useState(0);
  // Screenshots are not in the list data, so load them for the few highlighted apps.
  const [shots, setShots] = useState<Record<number, string[]>>({});
  const ids = apps.map(app => app.id).join(",");
  useEffect(() => {
    let active = true;
    Promise.all(ids.split(",").filter(Boolean).map(id => api.get<AppDetailDto>(`/api/applications/${id}`).then(detail => [Number(id), detail.screenshots ?? []] as const).catch(() => [Number(id), []] as const)))
      .then(entries => { if (active) setShots(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [ids]);
  if (!apps.length) return null;
  const count = apps.length;
  const move = (step: number) => setIndex(current => (current + step + count) % count);
  // Shortest distance from the selected card, so the list wraps around on both sides.
  const offsetOf = (i: number) => {
    let offset = (i - index + count) % count;
    if (offset > count / 2) offset -= count;
    return offset;
  };

  return <section className="hl-carousel" aria-label={label} aria-roledescription="carousel">
    <div className="hl-stage">
      {apps.map((app, i) => {
        const offset = offsetOf(i);
        const position = offset === 0 ? "is-center" : Math.abs(offset) === 1 ? "is-side" : "is-hidden";
        const category = app.products[0];
        // Up to three real screenshots on top, the app logo overlapping the bottom-left edge, details below.
        const covers = (shots[app.id] ?? []).slice(0, 3);
        const card = <>
          <span className="hl-cover" data-category={category} aria-hidden="true">
            {covers.length
              ? covers.map((shot, n) => <span key={n} className="hl-shot"><img src={shot} alt="" /></span>)
              : <span className="hl-cover-empty"><AppIcon value={app.icon} /></span>}
            <span className="hl-logo" data-has-logo={Boolean(app.image)}>{app.image ? <img src={app.image} alt="" /> : <AppIcon value={app.icon} />}</span>
          </span>
          <span className="hl-details">
            <strong className="hl-title">{app.name}</strong>
            <span className="hl-meta"><TypeChip type={app.type} /><small>{category ? categoryName(category) : "Standalone application"}</small></span>
          </span>
        </>;
        const style = { "--offset": offset } as CSSProperties;
        return offset === 0
          ? <Link key={app.id} to={`/ecosystem/${app.id}`} className={`hl-card ${position}`} style={style} aria-roledescription="slide">{card}</Link>
          : <button key={app.id} type="button" className={`hl-card ${position}`} style={style} tabIndex={position === "is-hidden" ? -1 : 0} aria-hidden={position === "is-hidden" || undefined} aria-label={`Show ${app.name}`} onClick={() => setIndex(i)}>{card}</button>;
      })}
      {count > 1 && <>
        <button type="button" className="hl-arrow is-prev" aria-label="Previous app" onClick={() => move(-1)}><AppIcon value="fa:arrow-left" /></button>
        <button type="button" className="hl-arrow is-next" aria-label="Next app" onClick={() => move(1)}><AppIcon value="fa:arrow-right" /></button>
      </>}
    </div>
    {count > 1 && <div className="hl-dots" role="group" aria-label="Choose app">
      {apps.map((app, i) => <button key={app.id} type="button" aria-label={app.name} aria-current={i === index || undefined} onClick={() => setIndex(i)} />)}
    </div>}
    <span className="sr-only" aria-live="polite">{apps[index].name}, {index + 1} of {count}</span>
  </section>;
}
