#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { startDynamicApp, type StartDynamicAppOptions } from "./server.js";

export interface StartArguments extends StartDynamicAppOptions {
  help: boolean;
}

export function parseStartArguments(argv: readonly string[]): StartArguments {
  const options: StartArguments = { help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    const value = () => {
      const candidate = argv[index + 1];
      if (!candidate || candidate.startsWith("-")) throw new Error(`Missing value for ${argument}`);
      index += 1;
      return candidate;
    };
    if (argument === "--config" || argument === "-c") options.configPath = value();
    else if (argument === "--registry" || argument === "-r") options.registry = value();
    else if (argument === "--host") options.host = value();
    else if (argument === "--port" || argument === "-p") {
      const port = Number(value());
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("--port must be between 1 and 65535");
      options.port = port;
    } else if (argument === "--no-install") options.install = false;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown start option: ${argument}`);
  }
  return options;
}

export function printStartHelp(): void {
  console.log(`Start the dynamic PLAIOS control plane.

Usage:
  plaios start [options]

Options:
  -c, --config <path>    Config file (default: plaios.yaml)
  -r, --registry <url>   Override package registry URL
      --host <host>      Override server host
  -p, --port <port>      Override server port
      --no-install       Do not install or update packages
  -h, --help             Show this help`);
}

export async function runStart(argv: readonly string[], currentDirectory = process.cwd()): Promise<void> {
  const options = parseStartArguments(argv);
  if (options.help) return printStartHelp();
  const handle = await startDynamicApp({ ...options, currentDirectory });
  console.log(`[dynamic] config ${handle.configPath}`);
  console.log(`[dynamic] control plane ${handle.url}`);
}

const isEntrypoint = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  runStart(process.argv.slice(2)).catch((error: unknown) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
