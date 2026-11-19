import { useState, type ReactNode } from "react";
import { AppIcon } from "./Icon";
import { Btn } from "./ui";
import "./carousel.css";

export type CarouselSlide = {
  id: string;
  title: string;
  content: ReactNode;
};

/**
 * banner: the slide fills the width.
 * centered: one slide in the middle with empty space on both sides (no neighbouring slides), arrows beside it.
 */
export function Carousel({ label, slides, variant = "banner" }: {
  label: string;
  slides: readonly CarouselSlide[];
  variant?: "banner" | "centered";
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const index = Math.max(0, slides.findIndex(slide => slide.id === selectedId));
  const current = slides[index];
  if (!current) return null;

  const centered = variant === "centered";
  const slideAt = (offset: number) => slides[(index + offset + slides.length) % slides.length];
  function move(offset: number) {
    setSelectedId(slideAt(offset).id);
  }

  return (
    <section className={`mgt-carousel${centered ? " mgt-carousel-centered" : ""}`} aria-label={label} aria-roledescription="carousel">
      <div className="mgt-carousel-stage">
        <div className="mgt-carousel-track">
          <div key={current.id} className="mgt-carousel-slide mgt-motion-enter" role="group" aria-roledescription="slide" aria-label={current.title}>
            {current.content}
          </div>
        </div>
        {slides.length > 1 && <>
          <Btn type="button" size="sm" variant="primary" iconOnly className="mgt-carousel-arrow mgt-carousel-prev" aria-label="Previous slide" onClick={() => move(-1)}>
            <AppIcon value="fa:chevron-right" />
          </Btn>
          <Btn type="button" size="sm" variant="primary" iconOnly className="mgt-carousel-arrow mgt-carousel-next" aria-label="Next slide" onClick={() => move(1)}>
            <AppIcon value="fa:chevron-right" />
          </Btn>
        </>}
      </div>
      {slides.length > 1 && (
        <div className="mgt-carousel-controls">
          <div className="mgt-carousel-pages" role="group" aria-label="Choose slide">
            {slides.map((slide, i) => (
              <button key={slide.id} type="button" aria-label={`Slide ${i + 1}: ${slide.title}`} aria-current={i === index ? "true" : undefined} onClick={() => setSelectedId(slide.id)} />
            ))}
          </div>
          <span className="sr-only" aria-live="polite">{index + 1} of {slides.length}: {current.title}</span>
        </div>
      )}
    </section>
  );
}
