import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Credentials {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

/** Pure: parse the contents of ~/.claude/.credentials.json. */
export function parseCredentials(text: string): Credentials | null {
  try {
    const raw = JSON.parse(text) as { claudeAiOauth?: Record<string, unknown> };
    const o = raw.claudeAiOauth;
    if (!o || typeof o.accessToken !== "string") return null;
    return {
      accessToken: o.accessToken,
      expiresAt: typeof o.expiresAt === "number" ? o.expiresAt : 0,
      refreshToken: typeof o.refreshToken === "string" ? o.refreshToken : undefined,
    };
  } catch {
    return null;
  }
}

export function credentialsPath(): string {
  return join(homedir(), ".claude", ".credentials.json");
}

export function readCredentials(path = credentialsPath()): Credentials | null {
  try {
    return parseCredentials(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
