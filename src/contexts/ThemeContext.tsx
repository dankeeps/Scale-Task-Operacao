import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Theme = "dark" | "light" | "special" | "pure";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void; // cycles dark -> light -> special -> pure -> dark
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const isTheme = (v: unknown): v is Theme =>
  v === "dark" || v === "light" || v === "special" || v === "pure";

function getInitialTheme(): Theme {
  // Synchronous, for the very first paint. The per-account theme is loaded from
  // the profile right after and overrides this if set.
  try {
    const stored = localStorage.getItem("theme");
    if (isTheme(stored)) return stored;
  } catch { /* ignore */ }
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // "special" uses the dark palette for content, so it also carries `.dark`.
  root.classList.toggle("dark", theme === "dark" || theme === "special");
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("special", theme === "special");
  // "pure" = white Todoist-style palette + normal expandable sidebar (no rail).
  root.classList.toggle("pure", theme === "pure");
  // `.rail` = floating collapsed sidebar (light + special).
  root.classList.toggle("rail", theme === "light" || theme === "special");
}

const NEXT: Record<Theme, Theme> = { dark: "light", light: "special", special: "pure", pure: "dark" };

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Apply to the DOM + cache locally (fast startup on this device).
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem("theme", theme); } catch { /* ignore */ }
  }, [theme]);

  // Load the per-account theme from the profile (syncs across devices).
  useEffect(() => {
    let active = true;
    const loadUserTheme = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data } = await supabase.from("profiles").select("theme").eq("id", user.id).maybeSingle();
      const t = (data as { theme?: string } | null)?.theme;
      if (active && isTheme(t)) setThemeState(t);
    };
    loadUserTheme();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") loadUserTheme();
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const persist = (t: Theme) => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from("profiles").update({ theme: t } as never).eq("id", user.id).then(() => {});
    });
  };

  const setTheme = (t: Theme) => { setThemeState(t); persist(t); };
  const toggleTheme = () => setTheme(NEXT[theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
