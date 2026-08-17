import { cn } from "@/lib/cn";

/**
 * A terminal window. Recall is a command-line tool first, so its output belongs
 * in the chrome it actually runs in — traffic lights, a title bar, a prompt.
 *
 * `scroll` bounds the body and scrolls inside it. That matters: several of these
 * hold hundreds of real rows, and a list that lengthens the page instead of
 * scrolling inside its own frame is how a long transcript stops being readable.
 */
export function Terminal({
  title,
  children,
  className,
  scroll,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Max body height, e.g. "22rem". Omit for a body that fits its content. */
  scroll?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-[#08090b] ring-1 ring-inset ring-white/[0.09]",
        "shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      {/* title bar */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-2">
          {/* close / minimize / zoom, in that order, as on macOS */}
          <span className="h-3 w-3 rounded-full bg-[#ff5f56] ring-1 ring-inset ring-black/20" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e] ring-1 ring-inset ring-black/20" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f] ring-1 ring-inset ring-black/20" />
        </div>
        <span className="truncate font-mono text-[11px] text-fog">{title}</span>
      </div>

      <div
        className={cn("overflow-auto p-5", scroll && "overscroll-contain")}
        style={scroll ? { maxHeight: scroll } : undefined}
      >
        {children}
      </div>

      {footer && (
        <div className="border-t border-white/[0.07] bg-white/[0.02] px-5 py-3 font-mono text-[11px] text-fog">
          {footer}
        </div>
      )}
    </div>
  );
}

/** A shell prompt line. */
export function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[12.5px] leading-relaxed">
      <span className="text-act">$ </span>
      <span className="text-ice">{children}</span>
    </div>
  );
}

/** Plain output line, dim by default. */
export function Out({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-fog",
        className,
      )}
    >
      {children ?? " "}
    </div>
  );
}
