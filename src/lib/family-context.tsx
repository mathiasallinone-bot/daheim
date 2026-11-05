import { createContext, useContext } from "react";
import type { Family } from "./data";

export const FamilyContext = createContext<Family | null>(null);
export function useFamily(): Family {
  const f = useContext(FamilyContext);
  if (!f) throw new Error("FamilyContext fehlt");
  return f;
}
