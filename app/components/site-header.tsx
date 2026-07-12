import { Link } from "react-router";
import { Wordmark } from "~/components/logo";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.17.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 22.3 24 17.8 24 12.5 24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4">
        <Link to="/" className="shrink-0">
          <Wordmark />
        </Link>
        <nav className="ml-2 hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
          <Link
            to="/play"
            className="rounded-md px-3 py-1.5 transition-colors hover:text-foreground"
          >
            Playground
          </Link>
          <a
            href="#concepts"
            className="rounded-md px-3 py-1.5 transition-colors hover:text-foreground"
          >
            Concepts
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild>
            <a
              href="https://github.com/campl-ucalgary/campl"
              target="_blank"
              rel="noreferrer"
              aria-label="CaMPL on GitHub"
              title="CaMPL on GitHub"
            >
              <GithubIcon className="size-4" />
            </a>
          </Button>
          <Button asChild size="sm" className="ml-1 hidden sm:inline-flex">
            <Link to="/play">Open Playground</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
