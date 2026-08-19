"use client";

import { useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * The thread. One line runs down the left of the whole page and draws itself as
 * you scroll; each stop is a hop on a real four-deep chain out of the jitsi-meet
 * scan, and it lights as the page passes it.
 *
 * It is a navigation aid that is also the argument: by the time a reader reaches
 * the bottom they have watched the page descend from an application to a
 * package nobody installed on purpose, one hop at a time.
 *
 * Desktop only. On a narrow screen a fixed rail costs more width than it earns.
 */

const HOPS = [
  "jitsi-meet",
  "webpack-dev-server",
  "sockjs",
  "faye-websocket",
  "websocket-driver",
];

export default function Rail() {
  const { scrollYProgress } = useScroll();
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", setP);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-1/2 left-6 z-40 hidden -translate-y-1/2 2xl:block"
    >
      <div className="relative flex flex-col justify-between" style={{ height: "56vh" }}>
        {/* undrawn track */}
        <span className="absolute top-0 bottom-0 left-[3.5px] w-px bg-white/[0.09]" />
        {/* drawn portion */}
        <motion.span
          className="absolute top-0 left-[3.5px] w-px origin-top bg-gradient-to-b from-act/80 to-act"
          style={{ bottom: 0, scaleY: scrollYProgress }}
        />

        {HOPS.map((hop, i) => {
          const at = i / (HOPS.length - 1);
          const lit = p >= at - 0.02;
          const isLast = i === HOPS.length - 1;
          return (
            <div key={hop} className="relative flex items-center gap-3">
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-all duration-500",
                  lit
                    ? isLast
                      ? "scale-150 bg-lose shadow-[0_0_16px_rgba(255,95,86,0.8)]"
                      : "bg-act shadow-[0_0_12px_rgba(255,171,61,0.7)]"
                    : "bg-white/20",
                )}
              />
              <span
                className={cn(
                  "font-mono text-[9.5px] tracking-[0.14em] whitespace-nowrap uppercase transition-colors duration-500",
                  lit ? (isLast ? "text-lose" : "text-fog") : "text-fog/25",
                )}
              >
                {hop}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
