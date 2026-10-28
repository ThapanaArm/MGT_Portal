import { createContext, useContext } from "react";
import type { useExampleModel } from "./useExampleModel";
export const ExampleContext = createContext<ReturnType<typeof useExampleModel> | null>(null);
export function useExample() { const value = useContext(ExampleContext); if (!value) throw new Error("Example provider required"); return value; }
