import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type QueueFilter = "open" | "waiting" | "mine" | "active" | "closed" | "all";

type PreferencesContextValue = {
  darkMode: boolean;
  notificationsEnabled: boolean;
  queueFilter: QueueFilter;
  setDarkMode: (value: boolean) => Promise<void>;
  setNotificationsEnabled: (value: boolean) => Promise<void>;
  setQueueFilter: (value: QueueFilter) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const DARK_MODE_KEY = "support_mobile_dark_mode";
const NOTIFICATIONS_KEY = "support_mobile_notifications_enabled";
const QUEUE_FILTER_KEY = "support_mobile_queue_filter";
const QUEUE_FILTERS = new Set<QueueFilter>(["open", "waiting", "mine", "active", "closed", "all"]);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkModeState] = useState(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [queueFilter, setQueueFilterState] = useState<QueueFilter>("open");

  useEffect(() => {
    AsyncStorage.multiGet([DARK_MODE_KEY, NOTIFICATIONS_KEY, QUEUE_FILTER_KEY]).then((items) => {
      const values = Object.fromEntries(items);
      setDarkModeState(values[DARK_MODE_KEY] === "true");
      setNotificationsEnabledState(values[NOTIFICATIONS_KEY] !== "false");
      const storedFilter = values[QUEUE_FILTER_KEY] as QueueFilter | undefined;
      if (storedFilter && QUEUE_FILTERS.has(storedFilter)) {
        setQueueFilterState(storedFilter);
      }
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      darkMode,
      notificationsEnabled,
      queueFilter,
      setDarkMode: async (next) => {
        setDarkModeState(next);
        await AsyncStorage.setItem(DARK_MODE_KEY, String(next));
      },
      setNotificationsEnabled: async (next) => {
        setNotificationsEnabledState(next);
        await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(next));
      },
      setQueueFilter: async (next) => {
        setQueueFilterState(next);
        await AsyncStorage.setItem(QUEUE_FILTER_KEY, next);
      }
    }),
    [darkMode, notificationsEnabled, queueFilter]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
