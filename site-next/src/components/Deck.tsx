"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { SectionLabel } from "./ui";

/**
 * The horizontal deck. The section pins to the viewport and vertical scrolling
 * drives the cards sideways instead of down — one screen per card, all of them
 * the same shape.
 *
 * Two rules it has to obey to be worth having:
 *
 *  - **Cards are peers.** Every card is exactly one viewport and carries a
 *    heading, one plain sentence and one piece of evidence. A track with one
 *    tall card in it has to size every other card to the worst case, which is
 *    what makes most horizontal sections feel padded.
 *  - **It never runs on a phone.** A horizontal pin fights the thumb: the user
 *    swipes down, the page refuses to move down, and the only way out is to
 *    keep scrolling through content they cannot see the end of. Below the
 *    desktop breakpoint the same cards render as ordinary stacked sections.
 *
 * The server render is the vertical one, so the readable layout is what exists
 * before JavaScript decides anything. Desktop upgrades to the track on mount.
 */

export type Card = {
  /** Section numeral, e.g. "02". */
  index: string;
  /** The small label beside the numeral. */
  label: string;
  /** Anchor id, so the nav can still reach it in the vertical layout. */
  id?: string;
  children: ReactNode;
};

export default function Deck({ cards }: { cards: Card[] }) {
  const [horizontal, setHorizontal] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    );
    const apply = () => setHorizontal(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!horizontal) {
    return (
      <>
        {cards.map((card) => (
          <section
            key={card.index}
            id={card.id}
            className="mx-auto w-full max-w-6xl px-6 py-24 lg:px-10"
          >
            <SectionLabel index={card.index}>{card.label}</SectionLabel>
            <div className="mt-8">{card.children}</div>
          </section>
        ))}
      </>
    );
  }

  return <Track cards={cards} />;
}

function Track({ cards }: { cards: Card[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // A short hold at each end, so the first card is readable before it starts
  // moving and the last one rests before the page continues downward.
  const x = useTransform(
    scrollYProgress,
    [0.06, 0.94],
    ["0vw", `-${(cards.length - 1) * 100}vw`],
  );

  return (
    <div
      ref={ref}
      className="relative"
      style={{ height: `${cards.length * 100}vh` }}
    >
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* progress hairline — the only cue that this is a track and not a stall */}
        <div className="absolute inset-x-0 top-0 z-20 h-px bg-white/[0.07]">
          <motion.div
            className="h-full origin-left bg-act"
            style={{ scaleX: scrollYProgress }}
          />
        </div>

        <motion.div
          style={{ x, width: `${cards.length * 100}vw` }}
          className="flex h-full"
        >
          {cards.map((card) => (
            <section
              key={card.index}
              id={card.id}
              className="flex h-full w-screen flex-none flex-col justify-center px-10 py-16 xl:px-20"
            >
              <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center">
                <SectionLabel index={card.index}>{card.label}</SectionLabel>
                <div className="mt-6 min-h-0">{card.children}</div>
              </div>
            </section>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
