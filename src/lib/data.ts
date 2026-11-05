import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { showKittenClip, showStarKitten } from "@/components/StarKitten";
import { mondayOf, todayZurich } from "@/lib/plan";
import { isRoutineClipTask, shouldShowRoutineClip, taskClip } from "@/lib/kitten-video";

const ROUTINE_SHOWN_KEY = "daheim-kitten-routine-shown";

export type Family = { id: string; name: string; invite_code: string };

export function useFamilyQuery() {
  return useQuery({
    queryKey: ["family"],
    queryFn: async (): Promise<Family | null> => {
      const { data, error } = await supabase
        .from("families")
        .select("id,name,invite_code")
        .order("created_at")
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Keine Verbindung – bitte später nochmals versuchen.";
  return msg || "Unbekannter Fehler";
}

export function useCompletions(familyId: string, from: string, to: string) {
  return useQuery({
    queryKey: ["completions", familyId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("id,day,task_key,stars,self_done,created_at")
        .eq("family_id", familyId)
        .gte("day", from)
        .lte("day", to);
      if (error) throw error;
      return data;
    },
  });
}

export function useLaundry(familyId: string) {
  return useQuery({
    queryKey: ["laundry", familyId],
    queryFn: async () => {
      const [req, done] = await Promise.all([
        supabase.from("laundry_requests").select("id,day,part").eq("family_id", familyId).order("day"),
        supabase
          .from("task_completions")
          .select("id,day,created_at,stars")
          .eq("family_id", familyId)
          .eq("task_key", "kleider-zusammenlegen"),
      ]);
      if (req.error) throw req.error;
      if (done.error) throw done.error;
      const byDay = new Map(done.data.map((d) => [d.day, d]));
      return req.data.map((r) => {
        const d = byDay.get(r.day);
        return { ...r, done: !!d, doneOn: d ? todayZurich(new Date(d.created_at)) : null, doneId: d?.id ?? null, doneStars: d?.stars ?? 0 };
      });
    },
  });
}

export function useBalance(familyId: string) {
  return useQuery({
    queryKey: ["balance", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("star_balance", { _family_id: familyId });
      if (error) throw error;
      return data ?? 0;
    },
  });
}

export function useRecurring(familyId: string) {
  return useQuery({
    queryKey: ["recurring", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_tasks")
        .select("*")
        .eq("family_id", familyId)
        .order("next_due");
      if (error) throw error;
      return data;
    },
  });
}

export function useSchedule(familyId: string) {
  return useQuery({
    queryKey: ["schedule", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_entries")
        .select("*")
        .eq("family_id", familyId)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

/** Toggle a child task for one calendar day. Unique (family, day, task) prevents duplicates. */
export function useToggleTask(familyId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { day: string; key: string; done: boolean; id?: string | undefined; selfDone?: boolean }) => {
      if (v.done && v.id) {
        // Serverseitig: nur heute bzw. laufende Woche; räumt Tagesabschluss/Wochenbonus nötigenfalls auf.
        const { error } = await supabase.rpc("undo_completion", { _id: v.id });
        if (error) throw error;
        return "undone" as const;
      }
      const { data, error } = await supabase
        .from("task_completions")
        .insert({ family_id: familyId, day: v.day, task_key: v.key, self_done: !!v.selfDone })
        .select("stars")
        .single();
      if (error && error.code !== "23505") throw error;
      if (data && data.stars > 0) showStarKitten(STAR_REASON[v.key] ?? "Belohnungsstern");
      else if (data) {
        // Hausaufgaben werden auf dem Montag der Woche gespeichert.
        const today = todayZurich();
        const clip = taskClip(v.key, v.key === "hausaufgaben" ? v.day === mondayOf(today) : v.day === today);
        if (clip) {
          if (isRoutineClipTask(v.key)) {
            let lastShownDay: string | null = null;
            try { lastShownDay = localStorage.getItem(ROUTINE_SHOWN_KEY); } catch { /* Gerätespeicher optional */ }
            if (shouldShowRoutineClip(Math.random(), lastShownDay, today) && showKittenClip(clip)) {
              try { localStorage.setItem(ROUTINE_SHOWN_KEY, today); } catch { /* Gerätespeicher optional */ }
            }
          } else showKittenClip(clip);
        }
      }
      return error ? ("dup" as const) : ("done" as const);
    },
    onSuccess: (r) => { if (r === "undone") toast.success("Wieder auf offen gesetzt"); return inv("completions", "balance", "laundry", "history"); },
    onError: (e) => toast.error("Nicht gespeichert", { description: friendlyError(e) }),
  });
}

export const STAR_REASON: Record<string, string> = {
  "buch-lesen": "📖 Fünfmal Buch gelesen · +1 ⭐",
  haarewaschen: "🧴 Haare selber gewaschen · +1 ⭐",
  "kleider-zusammenlegen": "🧺 Zehnmal Kleider zusammengelegt · +1 ⭐",
  abfall: "🗑️ Abfall runtergebracht · +1 ⭐",
};
