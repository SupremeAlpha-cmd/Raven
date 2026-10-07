"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  defaultRules,
  detectLaunches,
  evaluateAlerts,
  loadFeed,
  loadKeys,
  loadRules,
  loadSeenTokens,
  saveFeed,
  saveKeys,
  saveRules,
  saveSeenTokens,
  type AlertRule,
  type AlertRuleType,
  type FiredAlert,
} from "@/lib/alerts";
import type { NearGraduation } from "@/lib/graduation";
import type { TapeEntry } from "@/lib/tape";

const POLL_MS = 60_000;

interface AlertsApi {
  rules: AlertRule[];
  feed: FiredAlert[];
  unread: number;
  notifPerm: NotificationPermission | "unsupported";
  addRule: (type: AlertRuleType, threshold: number) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  setThreshold: (id: string, threshold: number) => void;
  dismissAlert: (id: string) => void;
  clearFeed: () => void;
  markRead: () => void;
  requestPermission: () => Promise<void>;
}

const Ctx = createContext<AlertsApi | null>(null);

export function useAlerts(): AlertsApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useAlerts must be used inside AlertsProvider");
  return api;
}

function pushNotification(a: FiredAlert): void {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  try {
    new Notification("Raven alert", {
      body: `${a.title}\n${a.detail}`,
      tag: a.id,
    });
  } catch {
    // notifications blocked at OS level — the in-app feed still has it
  }
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<AlertRule[]>(() => loadRules() ?? []);
  const [feed, setFeed] = useState<FiredAlert[]>(() => loadFeed());
  const [unread, setUnread] = useState(0);
  const [notifPerm, setNotifPerm] = useState<
    NotificationPermission | "unsupported"
  >(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  const firedKeys = useRef<Set<string> | null>(null);
  const seenTokens = useRef<Set<string> | null>(null);
  const seeded = useRef(false);
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  // Seed default rules on first ever run (persisted afterwards).
  useEffect(() => {
    if (loadRules() === null) {
      const d = defaultRules();
      setRules(d);
      saveRules(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poll = useCallback(async () => {
    if (firedKeys.current === null) firedKeys.current = loadKeys();
    if (seenTokens.current === null) seenTokens.current = loadSeenTokens();

    try {
      const [todayRes, tapeRes] = await Promise.all([
        fetch("/api/today", { cache: "no-store" }),
        fetch("/api/tape", { cache: "no-store" }),
      ]);
      const today = todayRes.ok ? await todayRes.json() : null;
      const tape = tapeRes.ok ? await tapeRes.json() : null;
      const nearing: NearGraduation[] = today?.nearing ?? [];
      const entries: TapeEntry[] = tape?.entries ?? [];

      const fresh = [
        ...(await evaluateAlerts(
          rulesRef.current,
          nearing,
          entries,
          firedKeys.current,
        )),
        ...detectLaunches(nearing, seenTokens.current, seeded.current),
      ];
      seeded.current = true;

      saveKeys(firedKeys.current);
      saveSeenTokens(seenTokens.current);

      if (fresh.length > 0) {
        setFeed((prev) => {
          const next = [...fresh, ...prev].slice(0, 50);
          saveFeed(next);
          return next;
        });
        setUnread((u) => u + fresh.length);
        fresh.forEach(pushNotification);
      }
    } catch {
      // a failed poll is just a missed cycle — the next one retries
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const api = useMemo<AlertsApi>(
    () => ({
      rules,
      feed,
      unread,
      notifPerm,
      addRule: (type, threshold) => {
        const rule: AlertRule = {
          id: `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          type,
          threshold,
          enabled: true,
        };
        setRules((prev) => {
          const next = [...prev, rule];
          saveRules(next);
          return next;
        });
      },
      removeRule: (id) => {
        setRules((prev) => {
          const next = prev.filter((r) => r.id !== id);
          saveRules(next);
          return next;
        });
      },
      toggleRule: (id) => {
        setRules((prev) => {
          const next = prev.map((r) =>
            r.id === id ? { ...r, enabled: !r.enabled } : r,
          );
          saveRules(next);
          return next;
        });
      },
      setThreshold: (id, threshold) => {
        if (!Number.isFinite(threshold) || threshold <= 0) return;
        setRules((prev) => {
          const next = prev.map((r) =>
            r.id === id ? { ...r, threshold } : r,
          );
          saveRules(next);
          return next;
        });
      },
      dismissAlert: (id) => {
        setFeed((prev) => {
          const next = prev.filter((a) => a.id !== id);
          saveFeed(next);
          return next;
        });
      },
      clearFeed: () => {
        setFeed([]);
        saveFeed([]);
      },
      markRead: () => setUnread(0),
      requestPermission: async () => {
        if (typeof window === "undefined" || !("Notification" in window))
          return;
        try {
          const p = await Notification.requestPermission();
          setNotifPerm(p);
        } catch {
          // user dismissed the prompt — stays "default"
        }
      },
    }),
    [rules, feed, unread, notifPerm],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
