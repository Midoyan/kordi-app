import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";

import { signInAsDispatcher } from "@/app/login/actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.1),_transparent_34%),linear-gradient(180deg,_#f8fafc,_#eef2f7)] px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)]">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to workspace
        </Link>

        <div className="mt-10">
          <p className="text-xs font-semibold tracking-[0.28em] text-muted-foreground uppercase">
            Demo access
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Sign in to Kordi
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            This lightweight login flow sets a demo user cookie so the sidebar can switch to the
            signed-in state.
          </p>
        </div>

        <form action={signInAsDispatcher} className="mt-8">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <LogIn className="size-4" />
            Continue as dispatcher
          </button>
        </form>
      </div>
    </main>
  );
}
