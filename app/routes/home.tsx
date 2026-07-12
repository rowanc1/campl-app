import {
  ArrowRight,
  GitBranch,
  Recycle,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Link } from "react-router";
import { EXAMPLES } from "~/campl/examples";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { SiteHeader } from "~/components/site-header";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "CaMPL — Categorical Message Passing Language" },
    {
      name: "description",
      content:
        "A typed, concurrent, functional language where processes communicate over typed channels. Try it in the browser.",
    },
  ];
}

const FEATURES = [
  {
    icon: Workflow,
    title: "Typed concurrency",
    body: "Channels carry typed communication protocols — the type system checks how processes talk, not just what they compute.",
  },
  {
    icon: ShieldCheck,
    title: "Deadlock & livelock free",
    body: "Pure CaMPL is guaranteed free of deadlocks and livelocks, and guarantees progress — by construction.",
  },
  {
    icon: GitBranch,
    title: "Controlled non-determinism",
    body: "Races let you express non-deterministic concurrent behaviour deliberately, where you want it.",
  },
  {
    icon: Recycle,
    title: "Sequential data & codata",
    body: "Alongside processes, CaMPL has a full functional core with data and codata declarations.",
  },
];

const HERO_SNIPPET = `coprotocol S => Console =
    ConsolePut :: S => Get( [Char] | S )
    ConsoleClose :: S => TopBot

proc helloworld :: | Console => =
    | console => -> do
        hput ConsolePut on console
        put "Hello World" on console
        hput ConsoleClose on console
        halt console`;

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.15]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, var(--color-primary) 0, transparent 40%), radial-gradient(circle at 80% 60%, var(--color-primary) 0, transparent 45%)",
            }}
          />
          <div className="mx-auto grid max-w-screen-xl items-center gap-10 px-4 py-16 md:py-24 lg:grid-cols-2">
            <div>
              <Badge variant="outline" className="mb-4 gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" />
                Categorical Message Passing Language
              </Badge>
              <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                Concurrency with a{" "}
                <span className="text-primary">type system</span> that keeps its
                promises.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
                CaMPL is a typed, functional-style concurrent language where
                processes communicate by passing messages on channels. Its
                semantics come from the categorical theory of message passing —
                and pure programs are deadlock- and livelock-free.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/play">
                    Open the playground <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a
                    href="https://github.com/campl-ucalgary/campl"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View the compiler
                  </a>
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden border-border/70 bg-card/60 shadow-xl backdrop-blur">
              <div className="flex items-center gap-1.5 border-b border-border/60 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  helloworld.mpl
                </span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
                {HERO_SNIPPET}
              </pre>
            </Card>
          </div>
        </section>

        {/* Features */}
        <section id="concepts" className="mx-auto max-w-screen-xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Why CaMPL?</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Four ideas set it apart from the concurrency you already know.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/70">
                <CardHeader className="pb-3">
                  <f.icon className="size-6 text-primary" />
                  <CardTitle className="mt-2 text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {f.body}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Examples */}
        <section className="border-t border-border/60 bg-muted/20">
          <div className="mx-auto max-w-screen-xl px-4 py-16">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Runnable examples
                </h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Compiled to abstract-machine instructions and executed in the
                  browser. Every terminal the program opens is a live pane.
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                className="hidden shrink-0 sm:inline-flex"
              >
                <Link to="/play">
                  Try them all <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {EXAMPLES.map((e) => (
                <Link key={e.id} to={`/play?example=${e.id}`} className="group">
                  <Card className="h-full border-border/70 transition-colors group-hover:border-primary/60">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{e.title}</CardTitle>
                        <Badge
                          variant="secondary"
                          className="ml-auto text-[10px] font-normal capitalize"
                        >
                          {e.level}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      <p>{e.summary}</p>
                      <div className="flex flex-wrap gap-1">
                        {e.concepts.slice(0, 3).map((c) => (
                          <Badge
                            key={c}
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-screen-xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>
            A demo of the{" "}
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="https://github.com/campl-ucalgary/campl"
              target="_blank"
              rel="noreferrer"
            >
              CaMPL
            </a>{" "}
            compiler from the University of Calgary.
          </p>
          <p>Running on a mock engine · WebAssembly build in progress.</p>
        </div>
      </footer>
    </div>
  );
}
