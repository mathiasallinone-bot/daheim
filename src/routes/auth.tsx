import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Nur interne Pfade erlauben (kein Weiterleiten auf fremde Seiten). */
function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({ next: safeNext(search['next']) }),
  head: () => ({
    meta: [
      { title: "Anmelden – Daheim" },
      { name: "description", content: "Melde dich bei Daheim, dem Familienplaner, an." },
      { property: "og:title", content: "Anmelden – Daheim" },
      { property: "og:description", content: "Melde dich bei Daheim, dem Familienplaner, an." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next = "/" } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await navigate({ href: next, replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: new URL(next, window.location.origin).href },
        });
        if (error) throw error;
        if (data.session) await navigate({ href: next, replace: true });
        else setMsg({ ok: true, text: "Fast geschafft: Bitte bestätige deine E-Mail-Adresse über den Link im Posteingang." });
      }
    } catch (err) {
      const m = (err as Error).message;
      setMsg({
        ok: false,
        text: /Invalid login/i.test(m) ? "E-Mail oder Passwort stimmt nicht." : m,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-card">
        <div className="mb-6 text-center">
          <div className="text-5xl">🏡</div>
          <h1 className="mt-2 text-4xl font-semibold">Daheim</h1>
          <p className="mt-1 text-muted-foreground">Der Familienplaner für Eltern und Siana</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Passwort</Label>
            <Input id="pw" type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-base" />
          </div>
          {msg && (
            <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-done-soft text-foreground" : "bg-holiday-soft text-holiday"}`}>
              {msg.text}
            </p>
          )}
          <Button type="submit" size="lg" className="h-13 w-full rounded-xl text-lg" disabled={busy}>
            {busy ? "Bitte warten…" : mode === "login" ? "Anmelden" : "Konto erstellen"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); }}
          className="mt-5 w-full py-3 text-center text-primary underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Anmelden"}
        </button>
      </div>
    </main>
  );
}
