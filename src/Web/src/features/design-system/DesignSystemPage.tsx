import { Tabs } from "@/shared/components/design-system";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useLocale } from "@/shared/lib/locale-context";
import { useTheme } from "@/shared/lib/theme-context";
import { BRAND_COLORS, COMPONENT_GROUPS, SPACES } from "./catalog";
import ComponentSpecimen from "./ComponentSpecimen";
import ExampleComponentUsage from "./ExampleComponentUsage";
import { EXAMPLE_PAGES } from "@/features/example/pages";
import { AppIcon } from "@/shared/components/IconPicker";
import "./design-system.css";

type Tab = "foundations" | "components" | "patterns";
const TABS: Tab[] = ["foundations", "components", "patterns"];

/** Design System foundations, component specimens, and page patterns. Open a specific tab with ?tab=components. */
export default function DesignSystemPage() {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "components";

  const tabLabel: Record<Tab, string> = {
    foundations: t("designSystem.tabFoundations"),
    components: t("designSystem.tabComponents"),
    patterns: t("designSystem.tabPatterns"),
  };
  const tabCount: Record<Tab, number> = { foundations: 4, components: COMPONENT_GROUPS.length, patterns: EXAMPLE_PAGES.length };

  return (
    <div>
      <div className="portal-page-heading mb-5">
        <div className="flex items-center gap-2 text-[12.5px] uppercase tracking-[0.14em] text-green-strong font-extrabold mb-1.5">
          <span className="w-2 h-2 rounded-sm bg-green" /> {t("nav.developerSection")}
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{t("designSystem.title")}</h1>
        <p className="text-ink-dim text-[16px] mt-1.5 max-w-[70ch] leading-relaxed">{t("designSystem.desc")}</p>
      </div>

      <Tabs items={TABS} value={tab} label={t("designSystem.title")} onChange={key=>setParams(key === "components" ? {} : {tab:key},{replace:true})} renderLabel={key=><>{tabLabel[key as Tab]}<span className="mgt-tab-count">{String(tabCount[key as Tab]).padStart(2,"0")}</span></>} />
      <div className="ds"><div className="ds-usage-guide"><div><i className="ds-guide-blue"/><span><strong>Blue · Primary actions</strong><small>Primary buttons, links, and selected navigation</small></span></div><div><i className="ds-guide-green"/><span><strong>Green · Brand accent</strong><small>Highlights, success states, and secondary buttons</small></span></div><div><i className="ds-guide-glass"/><span><strong>Glass · Navigation and feedback</strong><small>Sidebar, breadcrumbs, toasts, and alerts</small></span></div></div>{tab==="foundations"&&<Foundations/>}{tab==="components"&&<Components/>}{tab==="patterns"&&<Patterns/>}</div>
    </div>
  );
}
function SectionHeading({kicker,title,desc}:{kicker:string;title:string;desc:string}){return <div className="section-heading"><div><span className="kicker">{kicker}</span><h2>{title}</h2></div><p>{desc}</p></div>;}
function Foundations(){
 const {t}=useLocale();const {theme}=useTheme();
 const values=useMemo(()=>{const css=getComputedStyle(document.documentElement);return Object.fromEntries(BRAND_COLORS.map(color=>[color.token,css.getPropertyValue(color.token).trim()]));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[theme]);
 return <section className="section first"><SectionHeading kicker={t("designSystem.foundationsKicker")} title={t("designSystem.foundationsTitle")} desc={t("designSystem.foundationsDesc")}/><div className="panel"><div className="panel-title"><h3>{t("designSystem.brandColors")}</h3><span>{t("designSystem.cssVars")}</span></div><div className="swatches">{BRAND_COLORS.map(color=><div className="swatch" key={color.key}><i style={{background:`var(${color.token})`}}/><b>{color.name}</b><code>{color.token}</code><code>{values[color.token]?.toUpperCase()}</code><small>{t(`designSystem.colors.${color.key}`)}</small></div>)}</div></div>
 <div className="two-col"><div className="panel"><div className="panel-title"><h3>{t("designSystem.typography")}</h3><span>{t("designSystem.typeNote")}</span></div><div className="type-list"><div className="display">Display · Headings</div><div className="h1">Heading 1</div><div className="h2">Heading 2</div><div className="body">{t("designSystem.typeBody")}</div><div className="caption">CAPTION · METADATA · LABEL</div></div></div><div className="panel"><div className="panel-title"><h3>{t("designSystem.spacing")}</h3><span>{t("designSystem.spacingNote")}</span></div><div className="space-list">{SPACES.map(space=><div key={space}><i style={{width:space}}/><code>{space}px</code></div>)}</div><div className="radius-demo"><span><i style={{borderRadius:"var(--mgt-radius-sm)"}}/><code>Control · 8px</code></span><span><i style={{borderRadius:"var(--mgt-radius-md)"}}/><code>Card · 12px</code></span><span><i style={{borderRadius:"var(--mgt-radius-lg)"}}/><code>Feature · 16px</code></span></div></div></div>
 <div className="panel ds-icon-foundation" id="iconography"><div className="panel-title"><div><h3>Iconography</h3><p>Font Awesome · Classic Solid</p></div><a href="https://fontawesome.com/search?ic=free" target="_blank" rel="noopener noreferrer">Explore more icons <AppIcon value="fa:external-link"/><span className="sr-only"> (opens in a new tab)</span></a></div><p className="ds-icon-guidance">A shared set for navigation, actions, and status. Keep icons consistent and pair unfamiliar symbols with a clear label.</p><div className="ds-foundation-icons">{[["home","house","Home"],["users","users","People"],["code","code","Development"],["chart-line","chart-line","Analytics"],["receipt","receipt","Orders"],["calendar","calendar-days","Calendar"],["filter","filter","Filters"],["lock","lock","Security"],["gear","gear","Settings"],["check","circle-check","Approved"],["search","magnifying-glass","Search"],["arrow-right","arrow-right","Continue"]].map(([key,name,label])=><div key={key}><span className="ds-foundation-icon"><AppIcon value={`fa:${key}`}/></span><strong>{label}</strong><code>fa-{name}</code></div>)}</div><div className="ds-icon-sizing"><span>UI sizes</span>{[16,20,24].map(size=><span key={size}><AppIcon value="fa:users" className={`ds-icon-size-${size}`}/><small>{size}px</small></span>)}<p>Use 16px for controls, 20px for navigation, and 24px for feature accents.</p></div></div></section>;
}
function Components(){
 const {t}=useLocale();const [query,setQuery]=useState("");const [copied,setCopied]=useState("");const [copyError,setCopyError]=useState(false);const timer=useRef<number|undefined>(undefined);
 useEffect(()=>()=>window.clearTimeout(timer.current),[]);
 const groups=useMemo(()=>COMPONENT_GROUPS.filter(group=>`${t(`designSystem.groups.${group.type}.title`)} ${t(`designSystem.categories.${group.category}`)} ${group.selector}`.toLowerCase().includes(query.trim().toLowerCase())),[query,t]);
 async function copy(selector:string){try{await navigator.clipboard.writeText(selector);setCopied(selector);setCopyError(false);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setCopied(""),2000);}catch{setCopyError(true);}}
 return <section className="section first"><SectionHeading kicker={t("designSystem.componentsKicker")} title={t("designSystem.componentsTitle")} desc={t("designSystem.componentsDesc")}/><label className="ds-search"><AppIcon value="fa:search"/><input aria-label="Search components" placeholder="Search components..." value={query} onChange={event=>setQuery(event.target.value)}/></label>{copyError&&<p role="status">Unable to copy. Select and copy the component name manually.</p>}<div className="component-grid">{groups.map(group=><article className="component-card" key={group.type}><div className="card-head"><div><span>{t(`designSystem.categories.${group.category}`)}</span><h3>{t(`designSystem.groups.${group.type}.title`)}</h3></div><code>{group.selector}</code></div><ComponentSpecimen type={group.type}/><div className="card-foot"><p>{t(`designSystem.groups.${group.type}.guidance`)}</p><button type="button" onClick={()=>void copy(group.selector)}>{copied===group.selector?"Copied":t("designSystem.copySelector")}</button></div></article>)}</div>{!groups.length&&<p>No components match your search.</p>}</section>;
}
function Patterns(){
 const {t}=useLocale();
 return <section className="section first"><SectionHeading kicker={t("designSystem.patternsKicker")} title={t("designSystem.patternsTitle")} desc={t("designSystem.patternsDesc")}/><div className="pattern-grid">{EXAMPLE_PAGES.map(page=><article className="pattern-card" key={page.path}><div className="pattern-info"><span className="text-teal-strong text-2xl"><AppIcon value={page.icon}/></span><h3>{page.title}</h3><p>{page.description}</p><a href={`/design-preview/${page.path}`} target="_blank" rel="noopener noreferrer">Open example <AppIcon value="fa:external-link"/><span className="sr-only"> (opens in a new tab)</span></a></div></article>)}</div><ExampleComponentUsage/></section>;
}
