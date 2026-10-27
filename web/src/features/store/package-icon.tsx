import { cn } from "@plaios/microfrontend";

import { splitName } from "./package-format.js";

/** A stable monogram per package: the hue comes from the name, so a package always looks the same. */
export function PackageIcon({ name, large }: { name: string; large?: boolean }) {
  const short = splitName(name).short.replace(/^(action|input|output)-/, "");
  const hue = [...name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7);
  return <span
    aria-hidden="true"
    style={{ backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 40) % 360} 75% 45%))` }}
    className={cn("grid shrink-0 place-items-center font-semibold text-white uppercase shadow-sm", large ? "size-16 rounded-2xl text-2xl" : "size-10 rounded-xl text-sm")}
  >{short.slice(0, 2)}</span>;
}
