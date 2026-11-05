import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/data";

export function LoadingState({ full, label = "Wird geladen…" }: { full?: boolean; label?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-muted-foreground ${full ? "min-h-screen" : "py-10"}`} role="status">
      <Loader2 className="size-6 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ full, error, onRetry }: { full?: boolean; error: unknown; onRetry?: () => void }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 text-center ${full ? "min-h-screen" : "py-8"}`} role="alert">
      <p className="text-lg font-semibold">Daten konnten nicht geladen werden</p>
      <p className="text-sm text-muted-foreground">{friendlyError(error)}</p>
      {onRetry && <Button size="lg" className="h-12 rounded-xl" onClick={onRetry}>Nochmals versuchen</Button>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed p-5 text-center text-muted-foreground">{children}</p>;
}
