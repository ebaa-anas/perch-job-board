"use client";

import * as React from "react";

/**
 * Motion for the landing hero.
 *
 * Two constraints from the design spec: one hue, never a rainbow gradient;
 * and nothing that moves for its own sake. The spotlight tracks the pointer,
 * so the movement answers the visitor rather than looping at them.
 *
 * Whether the effect runs at all is decided in CSS, not here — `(pointer:
 * fine)` and `prefers-reduced-motion` are media queries, so they apply before
 * hydration and keep this component free of state. JavaScript's only job is
 * to publish the pointer position; everything else degrades on its own.
 */
export function HeroSpotlight() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;

    // Still checked here so we do not attach a listener that can never have a
    // visible effect; CSS has already hidden the layer in these cases.
    if (
      !window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      // Coalesced to one style write per frame: pointermove fires far faster
      // than the display refreshes and the extra writes are wasted work.
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const box = parent.getBoundingClientRect();
        node.style.setProperty("--x", `${event.clientX - box.left}px`);
        node.style.setProperty("--y", `${event.clientY - box.top}px`);
      });
    };

    parent.addEventListener("pointermove", onMove);
    return () => {
      parent.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="hero-spotlight pointer-events-none absolute inset-0"
    />
  );
}

/**
 * Cycles the last line of the headline through what people actually search
 * for here.
 *
 * Every option is rendered stacked in one grid cell, so the headline reserves
 * its full width up front and never reflows as the word changes — text
 * jumping on load is what makes an animated hero feel cheap.
 *
 * With reduced motion the interval never starts, `index` stays at 0, and the
 * first word simply stays put. No state is set from the effect body, and the
 * server-rendered markup already reads as a finished sentence.
 */
export function RotatingWord({
  words,
  className,
}: {
  words: string[];
  className?: string;
}) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (words.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      2600,
    );
    return () => window.clearInterval(id);
  }, [words.length]);

  return (
    <span
      /* No text-align of its own: it inherits the headline's centring, so
         the rotating line stays centred under the line above it. */
      className={`relative inline-grid align-bottom ${className ?? ""}`}
    >
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden={i !== index}
          data-shown={i === index || undefined}
          className="col-start-1 row-start-1 translate-y-[0.35em] opacity-0 transition-[opacity,transform] duration-500 data-[shown]:translate-y-0 data-[shown]:opacity-100"
        >
          {word}
        </span>
      ))}
    </span>
  );
}
