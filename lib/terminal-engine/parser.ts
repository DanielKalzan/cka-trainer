/**
 * Parses real kubectl/etcdctl command lines (not a DSL).
 *
 * Flags are classified as boolean or value-taking so `-o yaml`, `-o=yaml`,
 * `--dry-run=client`, `--ignore-daemonsets`, and repeatable `--from-literal`
 * all parse the way kubectl users expect.
 */

export interface ParsedCommand {
  bin: string;
  /** Positional arguments after the binary, flags removed. */
  args: string[];
  /** Last value wins, except repeatable flags which collect into `repeated`. */
  flags: Record<string, string | boolean>;
  repeated: Record<string, string[]>;
  /** Tokens after a bare `--` separator (exec/run command). */
  trailing: string[];
}

export class ParseError extends Error {}

/** Flags that never take a value. */
const BOOLEAN_FLAGS = new Set([
  "-A",
  "--all-namespaces",
  "--show-labels",
  "--ignore-daemonsets",
  "--delete-emptydir-data",
  "--force",
  "--overwrite",
  "--record",
  "--watch",
  "-w",
  "--rm",
  "-i",
  "-t",
  "-it",
  "-ti",
  "--stdin",
  "--tty",
  "--now",
  "--all",
  "--wait",
  "--insecure-skip-tls-verify",
  "--list",
]);

/** Flags whose value may repeat (collected in order). */
const REPEATABLE_FLAGS = new Set(["--from-literal", "--from-file", "--env"]);

/** Long flags where a bare occurrence (no =value) is legal and gets a default. */
const OPTIONAL_VALUE_FLAGS: Record<string, string> = {
  "--dry-run": "client",
};

const SHORT_ALIASES: Record<string, string> = {
  "-n": "--namespace",
  "-o": "--output",
  "-l": "--selector",
  "-f": "--filename",
  "-c": "--container",
};

export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  let started = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (started || cur.length > 0) {
        tokens.push(cur);
        cur = "";
        started = false;
      }
      continue;
    }
    cur += ch;
  }
  if (quote) throw new ParseError(`unclosed quote ${quote}`);
  if (started || cur.length > 0) tokens.push(cur);
  return tokens;
}

export function parseCommand(input: string): ParsedCommand {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) throw new ParseError("empty command");

  const [bin, ...rest] = tokens;
  const parsed: ParsedCommand = { bin, args: [], flags: {}, repeated: {}, trailing: [] };

  let i = 0;
  while (i < rest.length) {
    const tok = rest[i];

    if (tok === "--") {
      parsed.trailing = rest.slice(i + 1);
      break;
    }

    if (!tok.startsWith("-") || tok === "-") {
      // "-" is a positional (kubectl apply -f -)
      parsed.args.push(tok);
      i++;
      continue;
    }

    // Split --key=value
    let key = tok;
    let inlineValue: string | undefined;
    const eq = tok.indexOf("=");
    if (eq !== -1) {
      key = tok.slice(0, eq);
      inlineValue = tok.slice(eq + 1);
    }
    const canonical = SHORT_ALIASES[key] ?? key;

    if (inlineValue !== undefined) {
      if (REPEATABLE_FLAGS.has(canonical)) {
        (parsed.repeated[canonical] ??= []).push(inlineValue);
      } else {
        parsed.flags[canonical] = inlineValue;
      }
      i++;
      continue;
    }

    if (BOOLEAN_FLAGS.has(key) || BOOLEAN_FLAGS.has(canonical)) {
      parsed.flags[canonical === key ? key : canonical] = true;
      i++;
      continue;
    }

    if (canonical in OPTIONAL_VALUE_FLAGS) {
      // bare --dry-run
      const next = rest[i + 1];
      if (next && !next.startsWith("-") && (next === "client" || next === "server" || next === "none")) {
        parsed.flags[canonical] = next;
        i += 2;
      } else {
        parsed.flags[canonical] = OPTIONAL_VALUE_FLAGS[canonical];
        i++;
      }
      continue;
    }

    // Value-taking flag with space-separated value
    const next = rest[i + 1];
    if (next === undefined) {
      throw new ParseError(`flag ${tok} expects a value`);
    }
    if (REPEATABLE_FLAGS.has(canonical)) {
      (parsed.repeated[canonical] ??= []).push(next);
    } else {
      parsed.flags[canonical] = next;
    }
    i += 2;
  }

  return parsed;
}

/** Convenience accessors */
export function flagStr(cmd: ParsedCommand, key: string): string | undefined {
  const v = cmd.flags[key];
  return typeof v === "string" ? v : undefined;
}

export function flagBool(cmd: ParsedCommand, key: string): boolean {
  return cmd.flags[key] === true;
}
