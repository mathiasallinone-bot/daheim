import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Req = { what: string; stars: number; run: () => void };

/** Rückfrage, bevor eine erledigte Aufgabe wieder auf «offen» gesetzt wird. */
export function useConfirmUndo() {
  const [req, setReq] = useState<Req | null>(null);
  const ask = (what: string, stars: number, run: () => void) => setReq({ what, stars, run });
  const dialog = (
    <AlertDialog open={!!req} onOpenChange={(o) => { if (!o) setReq(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>«{req?.what}» wieder auf offen setzen?</AlertDialogTitle>
          <AlertDialogDescription>
            {req && req.stars > 0
              ? `Der Stern wird wieder abgezogen (−${req.stars} ⭐).`
              : "Die Aufgabe ist danach wieder offen."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-12">Abbrechen</AlertDialogCancel>
          <AlertDialogAction className="h-12" onClick={() => { req?.run(); setReq(null); }}>Ja, zurücknehmen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return [ask, dialog] as const;
}
