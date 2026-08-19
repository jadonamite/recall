import Image from "next/image";
import { Reveal } from "./ui";

/**
 * Who does the work. Each mark is the project's own published logo, taken from
 * its own site — HydraDB's icon, OSV's wordmark, deps.dev's favicon, the
 * Node.js light lockup, Vercel's and npm's marks from simple-icons — rather
 * than a wordmark standing in for one.
 *
 * Where a project publishes both a light and a dark variant, the one that is
 * legible on a near-black ground is the one used: OSV and Node.js both ship a
 * version whose type is white, and picking the wrong file is how a credit list
 * ends up with two invisible entries.
 *
 * Each entry says what it actually does here. "Powered by" strips that only
 * show logos are decoration; this one is a credit list.
 */

type Collaborator = {
  name: string;
  role: string;
  href: string;
  logo: string;
  /** A wordmark is wider than it is tall and must not be boxed square. */
  wide?: boolean;
};

const COLLABORATORS: Collaborator[] = [
  {
    name: "HydraDB",
    role: "the graph store — every traversal on this page ran on it",
    href: "https://hydradb.com",
    logo: "/logos/hydradb.png",
  },
  {
    name: "OSV",
    role: "advisory windows, per package name",
    href: "https://osv.dev",
    logo: "/logos/osv.png",
    wide: true,
  },
  {
    name: "npm",
    role: "the registry, and the lock format Recall replays",
    href: "https://www.npmjs.com",
    logo: "/logos/npm.png",
  },
  {
    name: "deps.dev",
    role: "resolved graphs when there is no lock file",
    href: "https://deps.dev",
    logo: "/logos/depsdev.png",
  },
  {
    name: "Node.js",
    role: "the runtime, with no framework underneath the tool",
    href: "https://nodejs.org",
    logo: "/logos/nodejs.png",
  },
  {
    name: "Vercel",
    role: "hosts this page",
    href: "https://vercel.com",
    logo: "/logos/vercel.png",
  },
];

export default function BuiltOn() {
  return (
    <section className="pt-28 lg:pt-36">
      <Reveal>
        <p className="font-mono text-[10px] tracking-[0.28em] text-fog uppercase">
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
                <span className="mt-0.5 grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-xl bg-white/[0.04] p-2 ring-1 ring-inset ring-white/[0.07] transition-colors group-hover:ring-white/20">
                  <Image
                    src={c.logo}
                    alt=""
                    width={c.wide ? 88 : 44}
                    height={44}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
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
