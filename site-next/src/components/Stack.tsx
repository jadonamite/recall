"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * A stacked panel. Each section is its own scroll track; the panel inside it
 * sticks to the top of the viewport, so the next section's panel slides up and
 * covers this one rather than pushing it away. Nothing scrolls off screen —
 * the page assembles into a pile.
 *
 * Two details do most of the work:
 *
 *  - The covered panel scales down slightly and dims as the next one arrives.
 *    Without that, a stack reads as a rendering bug: two flat panels occupying
 *    the same pixels with no depth cue explaining why.
 *  - Each panel carries its own rounded top edge and a hairline, so the seam
 *    where one covers another is legible as an edge rather than a colour change.
 *
 * `track` is how many viewports of scroll the section owns. 1 means the panel
 * covers the previous one and immediately begins being covered; longer tracks
 * hold a panel on screen while something inside it plays out.
 */
export function StackPanel({
  children,
  id,
  track = 1.15,
  className,
  last = false,
}: {
  children: ReactNode;
  id?: string;
  /** Scroll length in viewport heights. */
  track?: number;
  className?: string;
  /** The final panel is never covered, so it does not recede. */
  last?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    // From the moment this panel's track starts leaving the top of the viewport
    // (i.e. the next one is arriving) to the moment it is fully covered.
    offset: ["start start", "end start"],
  });

  // Hold still for the first third of the track, then recede. Nothing on
  // this page used to rest, which is what made the seams read as overlap
  // rather than as one panel covering another.
  const scale = useTransform(scrollYProgress, [0.34, 1], [1, last ? 1 : 0.93]);
  // Gone, not merely dimmed, well before the incoming panel finishes
  // arriving — two legible headings on screen at once is the bug.
  const opacity = useTransform(scrollYProgress, [0.34, 0.78], [1, last ? 1 : 0]);
  const y = useTransform(scrollYProgress, [0.34, 1], ["0%", last ? "0%" : "-4%"]);

  return (
    <section
      ref={ref}
      id={id}
      style={{ height: `${track * 100}vh` }}
      className="relative"
    >
      <div className="sticky top-0 flex min-h-dvh items-center overflow-hidden">
        <motion.div
          style={{ scale, opacity, y }}
          className={cn(
            "grain relative w-full origin-top overflow-hidden",
            "rounded-t-[2rem] lg:rounded-t-[2.5rem]",
            "bg-[linear-gradient(168deg,#171b21_0%,#0e1116_42%,#08090b_100%)]",
            "px-6 py-16 ring-1 ring-inset ring-white/[0.08] sm:px-10 lg:px-16 lg:py-24",
            "shadow-[0_-30px_90px_-40px_rgba(0,0,0,0.9)]",
            className,
          )}
        >
          {/* the light that makes the seam an edge */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />
          <div className="relative mx-auto w-full max-w-6xl">{children}</div>
        </motion.div>
      </div>
    </section>
  );
}
