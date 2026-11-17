import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useBlocker } from "react-router";
import { Dialog } from "@/shared/components/design-system";
import { Btn } from "@/shared/components/ui";

interface EditingGuard {
  register: (id: string) => () => void;
  requestExit: (action: () => void) => void;
  complete: (action: () => void) => void;
}
const Context = createContext<EditingGuard | null>(null);

export function EditingGuardProvider({ children }: { children: ReactNode }) {
  const [editors, setEditors] = useState<Set<string>>(new Set());
  const [exitAction, setExitAction] = useState<(() => void) | null>(null);
  const bypass = useRef(false);
  const active = editors.size > 0;
  const blocker = useBlocker(() => active && !bypass.current);
  const register = useCallback((id: string) => {
    setEditors(previous => new Set(previous).add(id));
    return () => setEditors(previous => { const next = new Set(previous); next.delete(id); return next; });
  }, []);
  const complete = useCallback((action: () => void) => {
    bypass.current = true;
    try { action(); } finally { queueMicrotask(() => { bypass.current = false; }); }
  }, []);
  const requestExit = useCallback((action: () => void) => {
    if (active) setExitAction(() => action); else action();
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
  const stay = () => { setExitAction(null); if (blocker.state === "blocked") blocker.reset(); };
  const leave = () => {
    const action = exitAction;
    setExitAction(null);
    if (blocker.state === "blocked") blocker.proceed();
    else if (action) complete(action);
  };
  return <Context.Provider value={{ register, requestExit, complete }}>{children}
    {(exitAction || blocker.state === "blocked") && <Dialog open confirmation title="Leave editing?" onClose={stay}
      footer={<><Btn autoFocus onClick={stay}>No, stay</Btn><Btn danger onClick={leave}>Yes, leave</Btn></>}>
      <p>Are you sure you want to leave? Any unsaved changes will be lost.</p>
    </Dialog>}
  </Context.Provider>;
}

export function useEditingGuard(active = false) {
  const context = useContext(Context);
  if (!context) throw new Error("EditingGuardProvider is required");
  const { register } = context;
  const id = useId();
  useEffect(() => active ? register(id) : undefined, [active, id, register]);
  return context;
}
