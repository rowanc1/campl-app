import { cn } from "~/lib/utils";

/** CaMPL brand mark: two processes exchanging a message on a channel. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-7", className)}
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8"
        className="fill-primary/10 stroke-primary"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="11" r="2.4" className="fill-primary" />
      <circle cx="22" cy="21" r="2.4" className="fill-primary" />
      <path
        d="M10 13.4v3.2a2 2 0 0 0 2 2h8"
        className="stroke-primary"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M17.5 15.5 20.8 18.6 17.7 22"
        className="stroke-primary"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <Logo />
      <span className="text-lg tracking-tight">
        Ca<span className="text-primary">MPL</span>
      </span>
    </span>
  );
}
