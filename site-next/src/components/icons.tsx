import { siGithub, siNpm, siVercel, siNodedotjs } from "simple-icons";
import { cn } from "@/lib/cn";

/**
 * Brand marks come from simple-icons, so they are the real logos rather than
 * approximations. Everything else is a hand-drawn line icon on the same
 * 24-unit grid with a 1.7 stroke — a mismatched icon set is one of the fastest
 * ways for a page to look assembled from parts.
 *
 * Where no accurate mark exists (HydraDB, OSV, deps.dev), the brand is set as
 * a wordmark instead of a guessed glyph.
 */

type BrandName = "github" | "npm" | "vercel" | "node";

const BRANDS = {
  github: siGithub,
  npm: siNpm,
  vercel: siVercel,
  node: siNodedotjs,
} as const;

export function Brand({
  name,
  className,
  title,
}: {
  name: BrandName;
  className?: string;
  title?: string;
}) {
  const icon = BRANDS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={title ?? icon.title}
      className={cn("h-5 w-5 fill-current", className)}
    >
      <path d={icon.path} />
    </svg>
  );
}

function Line({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
    >
      {children}
    </svg>
  );
}

/** Reverse traversal: an arrow climbing back up a branch. */
export function IconRecall({ className }: { className?: string }) {
  return (
    <Line className={className}>
      <circle cx="18" cy="19" r="2.4" />
      <circle cx="6" cy="5" r="2.4" />
      <path d="M16 17.2 8.2 7.2" />
      <path d="M6.4 10.6 5.6 7.4l3.2.8" />
    </Line>
  );
}

/** A lock file: document with pinned lines. */
export function IconLockfile({ className }: { className?: string }) {
  return (
    <Line className={className}>
      <path d="M6 3.5h8.5L19 8v12.5H6z" />
      <path d="M14 3.5V8h5" />
      <path d="M9 12h6M9 15.5h4" />
    </Line>
  );
}

/** Graph: three nodes, two edges. */
export function IconGraph({ className }: { className?: string }) {
  return (
    <Line className={className}>
      <circle cx="5" cy="17" r="2.2" />
      <circle cx="12" cy="6.5" r="2.2" />
      <circle cx="19" cy="17" r="2.2" />
      <path d="M6.6 15.2 10.5 8.4M13.5 8.4l3.9 6.8" />
    </Line>
  );
}

/** Terminal prompt. */
export function IconTerminal({ className }: { className?: string }) {
  return (
    <Line className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M7.5 10l2.5 2-2.5 2M12.5 14h4" />
    </Line>
  );
}

/** Arrow, for links that leave. */
export function IconArrow({ className }: { className?: string }) {
  return (
    <Line className={className}>
      <path d="M5 12h13" />
      <path d="M12.5 6.5 19 12l-6.5 5.5" />
    </Line>
  );
}

/** Shield, for the limits section. */
export function IconShield({ className }: { className?: string }) {
  return (
    <Line className={className}>
      <path d="M12 3.2 19 6v6c0 4.2-3 7.2-7 8.8-4-1.6-7-4.6-7-8.8V6z" />
      <path d="M9.2 12.2l2 2 3.6-4" />
    </Line>
  );
}
