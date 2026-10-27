import { useEffect, useState } from "react";

const KEY = "agent-os-theme";

export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem(KEY) === "dark");
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    // OpenUI follows the OS theme unless told otherwise; keep it in step with ours.
    root.dataset.openuiTheme = dark ? "dark" : "light";
    localStorage.setItem(KEY, dark ? "dark" : "light");
  }, [dark]);
  return { dark, setDark };
}
