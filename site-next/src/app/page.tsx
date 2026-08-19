import Link from "next/link";
import { Panel, Reveal, SectionLabel } from "@/components/ui";
import { Nav, Footer } from "@/components/Chrome";
import RecallNotice from "@/components/RecallNotice";
import Blocks from "@/components/Blocks";
import BuiltOn from "@/components/BuiltOn";
import Marquee from "@/components/Marquee";
import Collapse from "@/components/Collapse";
import { StackPanel } from "@/components/Stack";
import Deck from "@/components/Deck";
import { Terminal, Prompt, Out } from "@/components/Terminal";
import { IconArrow, IconShield, IconTerminal } from "@/components/icons";
import { site, num } from "@/lib/data";

/**
 * The page reads in two layers on purpose. The skim layer — display line, then
 * one plain sentence — carries the whole argument for someone who never stops
 * scrolling. The depth layer under it keeps the precise, technical statement
 * for a reader who has decided to check. Neither is a summary of the other:
 * removing the depth layer would make the page unfalsifiable, and removing the
 * skim layer is what the previous version did, which meant the argument only
 * landed for people who already knew the domain.
 *
 * Structurally each section is a panel that sticks and is covered by the next,
 * so nothing scrolls away. The exception is the collapse, which owns four
 * viewports of scroll and pins, because that transformation is the product.
 */

function Sources() {
  const s = site.publicSources;
  return (
    <>
      {s.map((x, i) => (
        <span key={x.name}>
          {i > 0 && (i === s.length - 1 ? " and " : ", ")}
          <a
            href={x.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-act-soft hover:text-ice"
          >
            {x.name}
          </a>
        </span>
      ))}
    </>
  );
}

export default function Home() {
  const c = site.consumer;

  return (
    <main>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-dvh overflow-hidden">
        <Marquee />
        <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 lg:px-10">
          <Nav />

          <div className="flex flex-1 flex-col justify-center py-14">
            <Reveal>
              <p className="font-mono text-[11px] tracking-[0.28em] text-act uppercase">
                The product-recall query for software
              </p>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="display display-xl mt-8 max-w-[17ch]">
                Your scanner names the part.
                <span className="text-fog"> Nobody names the car.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="lede mt-9 max-w-2xl text-ice/70">
                When a car part turns out to be dangerous, the factory doesn&rsquo;t
                publish the part number and wish you luck. It works out which
                cars were built with it, and writes to the people driving them.
                <span className="text-ice">
                  {" "}
                  Recall does that for your code.
                </span>
              </p>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-fog">
                Technically: a reverse traversal over the dependency graph.
                Given a compromised package, it returns every dependent{" "}
                <em>by path</em>, the size of the reachable subgraph, and the
                upgrade that severs the most paths.
              </p>
            </Reveal>

            <Reveal delay={0.22} className="mt-10">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="#collapse"
                  className="inline-flex items-center gap-2 rounded-full bg-act px-6 py-3.5 text-sm font-bold text-ice transition-colors hover:bg-act-soft hover:text-mid"
                >
                  Watch 135 problems become 40{" "}
                  <IconArrow className="h-4 w-4" />
                </Link>
                <a
                  href="/app/"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-ice ring-1 ring-white/15 ring-inset transition-colors hover:ring-white/30"
                >
                  <IconTerminal className="h-4 w-4" /> Open the tool
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.3}>
              <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-6 border-t border-white/[0.08] pt-8 lg:grid-cols-4">
                {[
                  ["packages in the graph", num(site.graph.packages)],
                  ["dependency links", num(site.graph.edges)],
                  ["advisory windows", num(site.graph.advisoryWindows)],
                  ["store", "HydraDB"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[10px] tracking-[0.16em] text-fog uppercase">
                      {k}
                    </dt>
                    <dd className="tnum mt-2 font-mono text-xl font-bold">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 01 · the trap ──────────────────────────────────────────────── */}
      {c && (
        <StackPanel id="wall" track={1.1}>
          <Reveal>
            <SectionLabel index="01">What every scanner does</SectionLabel>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="display display-lg mt-8 max-w-[16ch]">
              {num(c.findings)} problems.
              <span className="text-fog"> None of them yours.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="lede mt-8 max-w-2xl text-ice/70">
              This project installed {num(c.fixCount)} things on purpose. The
              scanner found {num(c.findings)} problems — almost all of them in
              packages nobody chose, sitting up to eight levels underneath the
              ones that were.{" "}
              <span className="text-ice">
                It won&rsquo;t tell you which of your {num(c.fixCount)} they came
                in through.
              </span>
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-fog">
              So you can&rsquo;t tell which single upgrade kills thirty findings
              at once, because a flat list has already thrown away the path. That
              is alert fatigue, and it is the defining failure of this whole
              category of tool: people learn the output is mostly noise and stop
              reading it.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-10 font-mono text-[11px] tracking-[0.16em] text-act uppercase">
              ↓ keep scrolling — the list sorts itself out
            </p>
          </Reveal>
        </StackPanel>
      )}

      {/* ── 02 · the pinned collapse ───────────────────────────────────── */}
      {c && (
        <div id="collapse" className="relative bg-mid">
          <Collapse data={c} />
        </div>
      )}

      {/* ── 03–06 · the horizontal deck ────────────────────────────────
          Four peer cards, each one screen. On a phone the same four render as
          ordinary stacked sections — see Deck. */}
      <Deck
        cards={[
          {
            index: "03",
            id: "notice",
            label: "The query no scanner can answer",
            children: (
              <>
                <h2 className="display display-lg max-w-[24ch]">
                  Your package was compromised.
                  <span className="text-fog"> Who do you write to?</span>
                </h2>
                <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-ice/70">
                  A scanner starts from your project, so it only ever answers{" "}
                  <em>am I affected</em>. Turn it around and you get the question
                  a factory asks the morning a part fails:{" "}
                  <span className="text-ice">
                    who shipped my part, through what, and how far did it get.
                  </span>{" "}
                  <span className="text-fog">
                    Measured, not illustrative — ~{num(site.graph.seedPackages)}{" "}
                    seed packages plus the lock files of <Sources />.
                  </span>
                </p>
                <div className="mt-6">
                  <RecallNotice notices={site.notices} compact />
                </div>
              </>
            ),
          },
          {
            index: "04",
            id: "how",
            label: "How it holds up",
            children: (
              <>
                <h2 className="display display-lg max-w-[18ch]">
                  Four things a flat scan
                  <span className="text-fog"> cannot do.</span>
                </h2>
                <div className="mt-7">
                  <Blocks compact />
                </div>
              </>
            ),
          },
          {
            index: "05",
            id: "graph",
            label: "Why this is not a table",
            children: (
              <>
                <h2 className="display display-lg max-w-[16ch]">
                  &ldquo;Reaches&rdquo;
                  <span className="text-fog"> is not a distance.</span>
                </h2>
                <p className="lede mt-6 max-w-2xl text-ice/70">
                  You can&rsquo;t answer this by finding things that look
                  similar. The broken package isn&rsquo;t <em>like</em> your app
                  — <span className="text-ice">it is inside it</span>, four
                  handshakes down. The only useful question is who is holding
                  whose hand, and that is a graph.
                </p>
                <div className="mt-7">
                  <Terminal title="the traversal, verbatim — HydraDB over Bolt">
                    <pre className="overflow-x-auto font-mono text-[12.5px] leading-relaxed text-fog">
                      {site.query
                        .split("relDirection: 'incoming'")
                        .map((part, i, arr) => (
                          <span key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <span className="font-bold text-act-soft">
                                relDirection: &apos;incoming&apos;
                              </span>
                            )}
                          </span>
                        ))}
                    </pre>
                  </Terminal>
                </div>
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-fog">
                  One word does it. <span className="text-ice">incoming</span>{" "}
                  walks the dependency links backwards — up from the broken
                  package to everything shipping it. That parameter is the entire
                  difference between a scanner and a recall.
                </p>
              </>
            ),
          },
          {
            index: "06",
            id: "limits",
            label: "Before you believe any of it",
            children: (
              <>
                <h2 className="display display-lg max-w-[16ch]">
                  The limits,
                  <span className="text-fog"> stated first.</span>
                </h2>
                <div className="mt-7">
                  <Panel className="p-6 lg:p-8">
                    <IconShield className="h-5 w-5 text-act" />
                    <ul className="mt-5 divide-y divide-white/[0.06]">
                      {[
                        [
                          "It proves the part is in the car. Not that anyone turned it on.",
                          "Recall shows a vulnerable version is in your tree and the chain that put it there. It does not claim the vulnerable function is ever called. Blurring the two is how this category lost its credibility.",
                        ],
                        [
                          "The shared graph is a judgement call, not a mirror of npm.",
                          `~${num(site.graph.seedPackages)} high-traffic seed packages with their resolved trees, plus ${site.graph.publicApps} public applications' lock files. Scanning your own project is unaffected, and your tree never joins this graph.`,
                        ],
                        [
                          "Sometimes there is no upgrade to make.",
                          "The real fix can be an overrides entry, and sometimes upstream has not shipped one at all. Recall tells you where the path enters; it does not promise the door opens.",
                        ],
                        [
                          "CVSS v4 vectors are reported unrated.",
                          "The v4 score is a lookup table, not a closed form. Running the v3 equation over a v4 vector produces a confident number that is simply wrong.",
                        ],
                      ].map(([head, body]) => (
                        <li key={head} className="py-3 first:pt-0 last:pb-0">
                          <span className="text-[14px] font-semibold text-ice">
                            {head}
                          </span>{" "}
                          <span className="text-[14px] leading-relaxed text-fog">
                            {body}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </div>
              </>
            ),
          },
        ]}
      />

      {/* ── close ──────────────────────────────────────────────────────── */}
      <StackPanel track={1} last className="bg-[linear-gradient(168deg,rgba(255,171,61,0.09)_0%,rgba(12,14,18,0.96)_46%,rgba(8,10,13,0.99)_100%)]">
        <div className="text-center">
          <Reveal>
            <h2 className="display display-lg mx-auto max-w-[18ch]">
              Software has a bill of materials.
              <span className="text-fog"> Now it has the query.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="script mx-auto mt-6 text-2xl text-act-soft">
              Nobody had to invent this — only implement it.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="lede mx-auto mt-7 max-w-xl text-ice/70">
              Open source, MIT, and the crawled graph ships with the repo — so it
              runs in one step instead of after an afternoon of crawling.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <a
                href="/app/"
                className="inline-flex items-center gap-2 rounded-full bg-act px-6 py-3.5 text-sm font-bold text-ice transition-colors hover:bg-act-soft hover:text-mid"
              >
                <IconTerminal className="h-4 w-4" /> Open the tool
              </a>
              <a
                href="https://github.com/jadonamite/recall"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-ice ring-1 ring-white/15 ring-inset transition-colors hover:ring-white/30"
              >
                Read the source <IconArrow className="h-4 w-4 -rotate-45" />
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mx-auto mt-12 max-w-lg text-left">
              <Terminal title="bash — one step, the graph ships with the repo">
                <Prompt>git clone github.com/jadonamite/recall</Prompt>
                <Prompt>npm install &amp;&amp; npm run load</Prompt>
                <Prompt>npm run recall ~/code/your-app</Prompt>
                <Out className="mt-2">
                  → your findings, collapsed onto their upgrades
                </Out>
              </Terminal>
            </div>
          </Reveal>
        </div>
      </StackPanel>

      {/* Attribution and footer sit in normal flow — they are reference
          material, and a stacked panel that has to scroll inside itself is
          the one shape this layout cannot hold. */}
      <section className="relative z-10 bg-mid">
        <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
          <BuiltOn />
          <Footer />
        </div>
      </section>
    </main>
  );
}
