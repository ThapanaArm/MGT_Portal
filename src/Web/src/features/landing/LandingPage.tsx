import { useEffect, useState } from "react";
import { Link } from "react-router";
import { LandingIcon } from "./LandingIcon";
import { useAuth } from "@/shared/lib/auth";
import "./landing.css";

const ROTATION_DELAY_MS = 6000;

const sections = [
  {
    id: "apps",
    title: "Company apps",
    summary: "Find apps built by employees and IT.",
    action: "Browse apps",
    to: "/ecosystem",
    cards: [
      { icon: "fileText", label: "Document tools" },
      { icon: "chartLine", label: "Sales tools" },
      { icon: "warehouse", label: "Inventory tools" },
    ],
  },
  {
    id: "requests",
    title: "App requests",
    summary: "Ask for a new app and check its review status.",
    action: "View app requests",
    to: "/my-apps",
    cards: [
      { icon: "plus", label: "Describe the app you need" },
      { icon: "users", label: "Say who will use it" },
      { icon: "check", label: "Check the review status" },
    ],
  },
  {
    id: "apis",
    title: "Web APIs",
    summary: "Find API endpoints and see how to use them.",
    action: "Browse APIs",
    to: "/explore",
    cards: [
      { icon: "code", label: "API catalog" },
      { icon: "box", label: "Product data" },
      { icon: "fileText", label: "Request and response details" },
    ],
  },
] as const;

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState(0);
  const [autoplay, setAutoplay] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const rotating = autoplay && !hovered && !focused;
  const section = sections[selected];

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => {
      setSelected((current) => (current + 1) % sections.length);
    }, ROTATION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, selected]);

  return (
    <div className="portal-landing">
      <header className="portal-landing-header portal-landing-inner">
        <Link to="/" className="portal-landing-brand" aria-label="MGT Portal home">
          <img src="/mgt-logo.png" alt="" />
          <span>Portal</span>
        </Link>
      </header>

      <main
        className="portal-landing-inner"
        onFocus={(event) => setFocused(event.target.matches(":focus-visible:not(.portal-landing-autoplay)"))}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
      >
        <section className="portal-landing-hero" aria-labelledby="portal-landing-title">
          <div className="portal-landing-intro">
            <h1 id="portal-landing-title">MGT Portal</h1>
            <p>Find apps for your daily work, request a tool for your team, or look up APIs for company systems.</p>
            <div className="portal-landing-actions">
              {!loading && (
                <Link to={user ? "/ecosystem" : "/login"} className="portal-landing-entry">
                  {user ? "Open App Ecosystem" : "Sign in"}
                  <LandingIcon name="arrowRight" />
                </Link>
              )}
            </div>
          </div>

          <section
            id="portal-landing-scene"
            className="portal-landing-scene"
            aria-labelledby="portal-landing-scene-title"
            aria-live={rotating ? "off" : "polite"}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <h2 id="portal-landing-scene-title">{section.title}</h2>
            <ul key={section.id} className="portal-landing-tiles">
              {section.cards.map(({ icon, label }) => (
                <li key={label}>
                  <LandingIcon name={icon} />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            {user && (
              <Link to={section.to} className="portal-landing-secondary portal-landing-scene-link">
                {section.action} <LandingIcon name="arrowRight" />
              </Link>
            )}
          </section>
        </section>

        <div
          className="portal-landing-switcher"
          role="group"
          aria-label="Explore MGT Portal"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {sections.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected === index}
              aria-controls="portal-landing-scene"
              onClick={() => setSelected(index)}
            >
              {selected === index && rotating && (
                <span
                  aria-hidden="true"
                  className="portal-landing-progress"
                  style={{ animationDuration: `${ROTATION_DELAY_MS}ms` }}
                />
              )}
              <span className="portal-landing-section-title">{item.title}</span>
              <span className="portal-landing-section-summary">{item.summary}</span>
            </button>
          ))}
          <button
            className="portal-landing-autoplay portal-landing-secondary"
            type="button"
            aria-controls="portal-landing-scene"
            onClick={() => setAutoplay((enabled) => !enabled)}
          >
            {autoplay ? "Pause autoplay" : "Start autoplay"}
          </button>
        </div>
      </main>
    </div>
  );
}
