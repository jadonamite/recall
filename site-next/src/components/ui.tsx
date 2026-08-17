"use client";

import { motion, useInView } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Surfaces, ported from Delta. The depth comes from three stacked cheap effects
 * rather than a drop shadow: a hairline inner highlight along the top edge
 * (light appears to fall from above), a very low-contrast diagonal gradient
 * across the fill, and a glow that only resolves on hover. Flat bordered boxes
 * are what make a page read as a template.
 */
export function Panel({
  children,
  className,
  glow = false,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "grain group relative overflow-hidden rounded-[1.75rem]",
        "bg-[linear-gradient(145deg,rgba(255,255,255,0.075)_0%,rgba(20,27,46,0.75)_38%,rgba(11,15,26,0.6)_100%)]",
        "ring-1 ring-inset ring-white/[0.09]",
        interactive &&
          "transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_24px_70px_-30px_rgba(61,116,255,0.55)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      {glow && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full bg-act/20 blur-3xl"
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * Recall's wordmark, built the way Binary's and Delta's are — split across two
 * colours so the family reads as one house.
 */
export function RecallMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={cn(
        "select-none text-lg font-black italic leading-none tracking-tight",
        className,
      )}
    >
      <span className="text-ice">RE</span>
      <span className="text-act">CALL</span>
    </span>
  );
}

/**
 * Section marker: an index numeral against a rule that fades out. Editorial
 * rather than a chip — the pill treatment reads as stock UI.
 */
export function SectionLabel({
  index,
  children,
}: {
  index: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-5">
      <span className="font-mono text-xs font-bold text-act">{index}</span>
      <span className="h-px w-14 bg-gradient-to-r from-act/70 to-transparent" />
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-fog">
        {children}
      </span>
    </div>
  );
}

/** Scroll reveal. Children stagger; nothing moves more than 16px. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Severity chip. The three semantic colours, never used decoratively. */
export function Sev({ label, score }: { label: string; score?: number | null }) {
  const tone =
    label === "CRITICAL"
      ? "text-lose ring-lose/35 bg-lose/10"
      : label === "HIGH"
        ? "text-gold ring-gold/35 bg-gold/10"
        : label === "MEDIUM"
          ? "text-act-soft ring-act/35 bg-act/10"
          : label === "LOW"
            ? "text-win ring-win/30 bg-win/10"
            : "text-fog ring-white/10 bg-white/[0.03]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide ring-1 ring-inset",
        tone,
      )}
    >
      {label}
      {score !== null && score !== undefined ? ` ${score}` : ""}
    </span>
  );
}

/** A checked feature line, as in the reference layout's blocks. */
export function Ticked({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-ice/75">
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="mt-0.5 h-4 w-4 flex-none text-act"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 10.5l4 4 8-9" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
