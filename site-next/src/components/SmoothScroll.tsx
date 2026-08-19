"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Damped scrolling. The whole page's motion is scroll-driven, and native wheel
 * scroll is a step function — it jumps in ~100px increments, which makes every
 * scrubbed animation stutter no matter how well it is written. Lenis
 * interpolates between those jumps, so a pinned section advances smoothly
 * instead of in visible notches.
 *
 * Two things it must not do: fight a user who has asked for less motion, and
 * break in-page anchor links. Both are handled below — under
 * `prefers-reduced-motion` it never initialises at all, and native
 * `scroll-behavior: smooth` stays in the stylesheet as the fallback path.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      // Light damping. Anything heavier reads as lag rather than weight — the
      // page should feel like it has mass, not like it is buffering.
      lerp: 0.11,
      wheelMultiplier: 1,
      // Touch devices already have momentum scrolling; doubling it feels wrong.
      smoothWheel: true,
      syncTouch: false,
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    // Anchor links have to go through Lenis, or the browser scrolls the real
    // scroll position out from under it and the two disagree until the next
    // wheel event.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        "a[href^='#'], a[href^='/#']",
      );
      const href = el?.getAttribute("href");
      if (!href) return;
      const hash = href.slice(href.indexOf("#"));
      if (hash === "#") return;
      // On another route the link is a real navigation, not a scroll.
      if (href.startsWith("/#") && window.location.pathname !== "/") return;
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -24 });
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
