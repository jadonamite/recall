"use client";

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "motion/react";
import { Sev } from "./ui";
import { num, type Consumer } from "@/lib/data";

/**
 * The pinned stage — the one moment on this page that is the product rather
 * than a description of it.
 *
 * The section owns just under three viewports of scroll. For all of it the viewport is held
 * still and the scroll position drives a transformation instead: 135 scanner
 * findings compress upward and blur out, and the 40 direct dependencies they
 * actually enter through resolve in their place, one band at a time.
 *
 * The honesty of the claim is the reason it is built this way. Nothing is
 * filtered between the two states — the count in the middle counts down from
 * 135 to 40 because the findings are being *grouped*, not discarded, and a
 * cross-fade between two static lists would let a viewer suspect otherwise.
 */
export default function Collapse({ data }: { data: Consumer }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // The wall holds, compresses, then is gone. Origin is the top so it reads as
  // a stack settling rather than a box shrinking towards its own middle.
  const wallScale = useTransform(scrollYProgress, [0.10, 0.52], [1, 0.34]);
  const wallOpacity = useTransform(scrollYProgress, [0.14, 0.48], [1, 0]);
  const wallBlur = useTransform(scrollYProgress, [0.14, 0.48], [0, 14]);
  const wallFilter = useTransform(wallBlur, (b) => `blur(${b}px)`);

  const fixOpacity = useTransform(scrollYProgress, [0.36, 0.56], [0, 1]);
  const fixY = useTransform(scrollYProgress, [0.36, 0.62], [56, 0]);

  return (
    <div ref={ref} className="relative h-[280vh]">
      <div className="sticky top-0 flex min-h-dvh flex-col justify-center overflow-hidden px-6 py-16 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">
          <Readout progress={scrollYProgress} data={data} />

          <div className="relative mt-10 h-[46vh] min-h-[20rem]">
            {/* ── state one: the wall ── */}
            <motion.div
              style={{
                scaleY: wallScale,
                opacity: wallOpacity,
                filter: wallFilter,
              }}
              className="absolute inset-0 origin-top overflow-hidden rounded-2xl bg-[#08090b] ring-1 ring-inset ring-white/[0.08]"
            >
              <div className="border-b border-white/[0.07] bg-white/[0.03] px-4 py-2.5 font-mono text-[11px] text-fog">
                npm audit · {num(data.findings)} findings, alphabetical
              </div>
              <div className="p-4">
                {data.wall.map(([label, key, osv], i) => (
                  <div
                    key={i}
                    className="font-mono text-[11px] leading-[1.75] whitespace-nowrap text-fog/55"
                  >
                    <span className="inline-block w-[9ch] text-fog/70">
                      {label}
                    </span>
                    <span className="inline-block w-[34ch] text-ice/45">
                      {key}
                    </span>
                    <span className="text-fog/40">{osv}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── state two: what you actually change ── */}
            <motion.div
              style={{ opacity: fixOpacity, y: fixY }}
              className="absolute inset-0 overflow-hidden rounded-2xl bg-[#08090b] ring-1 ring-inset ring-act/25 shadow-[0_40px_120px_-50px_rgba(255,171,61,0.35)]"
            >
              <div className="border-b border-white/[0.07] bg-act/[0.06] px-4 py-2.5 font-mono text-[11px] text-act-soft">
                recall · {num(data.fixCount)} things you can actually change
              </div>
              <div className="space-y-1 p-4">
                {data.fixes.slice(0, 9).map((f, i) => (
                  <FixRow
                    key={f.package}
                    progress={scrollYProgress}
                    index={i}
                    fix={f}
                  />
                ))}
              </div>
            </motion.div>
          </div>

          <p className="mt-8 max-w-xl font-mono text-[11px] leading-relaxed text-fog">
            Nothing was filtered. Every one of the {num(data.findings)} findings
            is still there — each one just got sorted under the single dependency
            of yours it arrived through.
          </p>
        </div>
      </div>
    </div>
  );
}

/** The count in the middle, interpolated rather than swapped. */
function Readout({
  progress,
  data,
}: {
  progress: MotionValue<number>;
  data: Consumer;
}) {
  const counted = useTransform(
    progress,
    [0.18, 0.52],
    [data.findings, data.fixCount],
  );
  const [n, setN] = useState(data.findings);
  useMotionValueEvent(counted, "change", (v) => setN(Math.round(v)));

  const [flipped, setFlipped] = useState(false);
  useMotionValueEvent(progress, "change", (v) => setFlipped(v >= 0.40));

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <span className="tnum block text-[clamp(4.5rem,16vw,11rem)] leading-[0.8] font-black tracking-[-0.055em]">
        {n}
      </span>
      <div className="pb-2">
        <span className="block text-[clamp(1.5rem,4vw,2.6rem)] leading-none font-extrabold tracking-[-0.035em]">
          {flipped ? "things to fix." : "problems."}
        </span>
        <span className="mt-2 block font-mono text-[11px] tracking-[0.16em] text-fog uppercase">
          {flipped
            ? "your own dependencies · one upgrade each"
            : "packages you never chose · buried up to 8 deep"}
        </span>
      </div>
    </div>
  );
}

/** One resolved upgrade. They land in sequence, top-down, as the scroll finishes. */
function FixRow({
  progress,
  index,
  fix,
}: {
  progress: MotionValue<number>;
  index: number;
  fix: Consumer["fixes"][number];
}) {
  const start = 0.40 + index * 0.022;
  const opacity = useTransform(progress, [start, start + 0.06], [0, 1]);
  const x = useTransform(progress, [start, start + 0.08], [-18, 0]);

  return (
    <motion.div
      style={{ opacity, x }}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.05] py-2 last:border-b-0"
    >
      <span className="tnum w-[2ch] font-mono text-[10px] text-fog">
        {index + 1}
      </span>
      <Sev label={fix.label} score={fix.score} />
      <span className="font-mono text-[12.5px] break-all text-ice">
        {fix.package}
      </span>
      <span className="tnum ml-auto font-mono text-[10.5px] whitespace-nowrap text-fog">
        cuts {fix.paths} paths
      </span>
    </motion.div>
  );
}
