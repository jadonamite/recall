import { Brand } from "./icons";
import { Reveal } from "./ui";

/**
 * Who does the work. Real marks where an accurate one exists (simple-icons);
 * a wordmark where it does not, because a guessed glyph for someone else's
 * brand is worse than their name set properly.
 *
 * Each entry says what it actually does here. "Powered by" strips that only
 * show logos are decoration; this one is a credit list.
 */

type Collaborator = {
  name: string;
  role: string;
  href: string;
  mark?: "github" | "npm" | "vercel" | "node";
  /** Wordmark styling when there is no accurate logo to use. */
  word?: string;
};

const COLLABORATORS: Collaborator[] = [
  {
    name: "HydraDB",
    role: "the graph store — every traversal on this page ran on it",
    href: "https://hydradb.com",
    word: "Hydra",
  },
  {
    name: "OSV",
    role: "advisory windows, per package name",
    href: "https://osv.dev",
    word: "OSV",
  },
  {
    name: "npm",
    role: "the registry, and the lock format Recall replays",
    href: "https://www.npmjs.com",
    mark: "npm",
  },
  {
    name: "deps.dev",
    role: "resolved graphs when there is no lock file",
    href: "https://deps.dev",
    word: "deps.dev",
  },
  {
    name: "Node.js",
    role: "the runtime, with no framework underneath the tool",
    href: "https://nodejs.org",
    mark: "node",
  },
  {
    name: "Vercel",
    role: "hosts this page",
    href: "https://vercel.com",
    mark: "vercel",
  },
];

export default function BuiltOn() {
  return (
    <section className="pt-28 lg:pt-36">
      <Reveal>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-fog">
          Who does the work
        </p>
      </Reveal>

      <Reveal delay={0.06} className="mt-8">
        <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {COLLABORATORS.map((c) => (
            <li key={c.name}>
              <a
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-4"
              >
                <span className="mt-0.5 grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/[0.04] text-fog ring-1 ring-inset ring-white/[0.07] transition-colors group-hover:text-ice group-hover:ring-white/20">
                  {c.mark ? (
                    <Brand name={c.mark} title={c.name} className="h-5 w-5" />
                  ) : (
                    <span className="font-mono text-[11px] font-bold tracking-tight">
                      {c.word}
                    </span>
                  )}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ice">
                    {c.name}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-fog">
                    {c.role}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
