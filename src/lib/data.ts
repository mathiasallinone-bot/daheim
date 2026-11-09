import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { showKittenClip, showStarKitten } from "@/components/StarKitten";
import { mondayOf, todayZurich } from "@/lib/plan";
import { isRoutineClipTask, shouldShowRoutineClip, starClip, taskClip } from "@/lib/kitten-video";

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
      if (data && data.stars > 0) showStarKitten(starReason(v.key, data.stars), starClip(v.key, data.stars));
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
  katzenklo: "🧹 Fünfmal Katzenklo geputzt · +1 ⭐",
  fruehaufsteher: "🌅 Überraschung! Die ganze Woche am Morgen schnell gewesen · +1 ⭐",
  "hausaufgaben-bonus": "📝 Überraschung! Hausaufgaben schon am Montag erledigt · +1 ⭐",
};

/** Text für das Stern-Kätzchen, abhängig von der Anzahl Sterne. */
export function starReason(key: string, stars: number): string {
  if (key === "buch-lesen" && stars >= 2) return `📖✨ Doppelstern! Fünfmal Buch gelesen · +${stars} ⭐`;
  if (key === "katzenklo" && stars > 1) return `🧹✨ Katzenklo-Spezialwoche! · +${stars} ⭐`;
  return STAR_REASON[key] ?? (stars > 1 ? `Belohnung · +${stars} ⭐` : "Belohnungsstern");
}

/** Geheime Extras und Abzüge, die die Datenbank selbst bucht. */
export const SPECIAL_KEYS = ["fruehaufsteher", "hausaufgaben-bonus", "abzug"] as const;

export function useSpecialRewards(familyId: string) {
  return useQuery({
    // unter "completions", damit jedes Abhaken die Liste neu lädt
    queryKey: ["completions", familyId, "specials"],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("task_completions")
        .select("id,day,task_key,stars,created_at")
        .eq("family_id", familyId)
        .in("task_key", [...SPECIAL_KEYS])
        .gte("created_at", since)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export type ClosureStatus = { counter: number; limit: number; new_penalties: number };

/** Zähler vergessener Abschlüsse; bucht fällige Abzüge (Server prüft alles). */
export function useClosureStatus(familyId: string) {
  return useQuery({
    queryKey: ["completions", familyId, "closure-status"],
    queryFn: async (): Promise<ClosureStatus> => {
      const { data, error } = await supabase.rpc("closure_status", { _family_id: familyId });
      if (error) throw error;
      return data as unknown as ClosureStatus;
    },
    staleTime: 60_000,
  });
}

export type WaterCheck = { day: string; hour: number; kind: string; answered_at: string };

/** Antworten auf die Wasser-Erinnerung für einen Tag. */
export function useWaterChecks(familyId: string, day: string) {
  return useQuery({
    queryKey: ["water", familyId, day],
    queryFn: async (): Promise<WaterCheck[]> => {
      const { data, error } = await supabase
        .from("water_checks")
        .select("day,hour,kind,answered_at")
        .eq("family_id", familyId)
        .eq("day", day);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useAnswerWater(familyId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { day: string; hour: number; kind: "flasche" | "trinken"; undo?: boolean }) => {
      if (v.undo) {
        const { error } = await supabase.from("water_checks").delete().eq("family_id", familyId).eq("day", v.day).eq("hour", v.hour);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("water_checks").insert({ family_id: familyId, day: v.day, hour: v.hour, kind: v.kind });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => inv("water"),
    onError: (e) => toast.error("Nicht gespeichert", { description: friendlyError(e) }),
  });
}
