import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Home, LogOut, Star, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError, useFamilyQuery } from "@/lib/data";
import { FamilyContext } from "@/lib/family-context";
import { LoadingState, ErrorState } from "@/components/States";
import { StarKittenHost } from "@/components/StarKitten";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // Lokale Sitzung genügt (schnell, auch offline); die Datenbank prüft jede Anfrage selbst (RLS).
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: location.href === "/" ? {} : { next: location.href } });
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/", label: "Heute", icon: Home },
  { to: "/woche", label: "Woche", icon: CalendarDays },
  { to: "/sterne", label: "Sterne", icon: Star },
  { to: "/arbeiten", label: "Arbeiten", icon: Wrench },
] as const;

function AuthedLayout() {
  const q = useFamilyQuery();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (q.isPending) return <LoadingState full />;
  if (q.isError) return <ErrorState full error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <FamilySetup onSignOut={signOut} />;

  return (
    <FamilyContext.Provider value={q.data}>
      <div className="min-h-dvh pb-[calc(7rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <header className="mx-auto flex max-w-4xl items-center justify-between px-5 pt-[max(1.5rem,env(safe-area-inset-top))] md:px-8">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-3xl">🐱</span>
            <span className="font-display text-3xl font-bold text-primary">Daheim <span className="text-star">✨</span></span>
          </div>
          <Button variant="ghost" size="lg" onClick={signOut} aria-label="Abmelden" className="h-12 min-w-12 gap-2 rounded-xl">
            <LogOut className="size-5" /> <span className="hidden sm:inline">Abmelden</span>
          </Button>
        </header>
        <main className="mx-auto max-w-4xl px-5 pt-4 md:px-8">
          <Outlet />
        </main>
        <StarKittenHost />
        <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-40 rounded-t-[2rem] border-t-4 border-secondary bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto grid max-w-4xl grid-cols-4">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true, includeSearch: false }}
                className="flex min-h-[68px] flex-col items-center justify-center gap-1 text-sm text-muted-foreground data-[status=active]:font-bold data-[status=active]:text-primary data-[status=active]:[&_svg]:scale-125 [&_svg]:transition"
              >
                <Icon aria-hidden className="size-6" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </FamilyContext.Provider>
  );
}

function FamilySetup({ onSignOut }: { onSignOut: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ error: unknown }>) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    await qc.invalidateQueries({ queryKey: ["family"] });
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 px-5 py-10">
      <h1 className="text-3xl font-semibold">Willkommen bei Daheim</h1>
      <p className="text-muted-foreground">
        Lege einen privaten Familienbereich an oder tritt mit einem Einladungscode bei. Alle Daten sind nur für Mitglieder dieser Familie sichtbar.
      </p>
      <section className="space-y-3 rounded-3xl bg-card p-6 shadow-card">
        <h2 className="text-xl font-semibold">Neue Familie</h2>
        <Input placeholder="Name, z. B. Familie Muster" value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" />
        <Button size="lg" className="h-12 w-full rounded-xl" disabled={busy} onClick={() => run(async () => await supabase.rpc("create_family", { _name: name }))}>
          Familie anlegen
        </Button>
      </section>
      <section className="space-y-3 rounded-3xl bg-card p-6 shadow-card">
        <h2 className="text-xl font-semibold">Einladung annehmen</h2>
        <Input placeholder="Einladungscode" value={code} onChange={(e) => setCode(e.target.value)} className="h-12 text-base" />
        <Button size="lg" variant="secondary" className="h-12 w-full rounded-xl" disabled={busy || !code.trim()} onClick={() => run(async () => await supabase.rpc("join_family", { _code: code }))}>
          Beitreten
        </Button>
      </section>
      <Button variant="ghost" onClick={onSignOut} className="h-12 w-full">Abmelden</Button>
    </main>
  );
}
