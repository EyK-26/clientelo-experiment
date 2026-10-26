import { appProfile } from "./appProfile";

export interface AppConfig {
  port: number;
  /** Optional listen address; independent of the trusted public APP_URL. */
  hostname?: string;
  appUrl: string;
  databaseUrl: string;
}

export function loadConfig(): AppConfig {
  appProfile();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return {
    port: Number(process.env.PORT ?? 3000),
    hostname: process.env.HOST?.trim() || undefined,
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    databaseUrl,
  };
}

/** Cookie sessions and signed cookies are keyed by this; there is no default. */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is required. Copy .env.example to .env and set it (32+ characters).",
    );
  }
  return secret;
}
