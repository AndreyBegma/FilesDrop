'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type ShellState = {
  /** Whether the uploads history panel is open. The history slot reads it. */
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  toggleHistory: () => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({
  children,
  onHistoryToggle,
}: {
  children: ReactNode;
  /** Optional observer, called with the new state on every change. */
  onHistoryToggle?: (open: boolean) => void;
}) {
  const [historyOpen, setOpen] = useState(false);

  const setHistoryOpen = useCallback(
    (open: boolean) => {
      setOpen(open);
      onHistoryToggle?.(open);
    },
    [onHistoryToggle],
  );

  const toggleHistory = useCallback(() => {
    setHistoryOpen(!historyOpen);
  }, [historyOpen, setHistoryOpen]);

  const value = useMemo(
    () => ({ historyOpen, setHistoryOpen, toggleHistory }),
    [historyOpen, setHistoryOpen, toggleHistory],
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}

export function useShell(): ShellState {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside <ShellProvider>');
  return value;
}
