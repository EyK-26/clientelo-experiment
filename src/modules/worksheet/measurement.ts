import { appProfile } from "../../bootstrap/appProfile";
// No public tracker is enabled. These tags describe the two synthetic QA creatives.
export function attribution(query: URLSearchParams): "a" | "b" | null {
  for (const [key, expected] of Object.entries({
    utm_source: "demo",
    utm_medium: "ad",
    utm_campaign: "etf_compare",
  })) {
    const values = query.getAll(key);
    if (values.length !== 1 || values[0] !== expected) return null;
  }
  const variants = query.getAll("ad_variant");
  return variants.length === 1 && (variants[0] === "a" || variants[0] === "b")
    ? variants[0]
    : null;
}

export function controlledWorksheetEnabled(
  env: Record<string, string | undefined>,
): boolean {
  if (env.WORKSHEET_CONTROLLED_TESTS !== "1") return false;
  if (env.APP_ENV !== "test" && appProfile(env) === "worksheet-qualification") {
    let origin: URL, database: URL;
    try {
      origin = new URL(env.APP_URL!);
      database = new URL(env.DATABASE_URL!);
    } catch {
      throw new Error("Invalid controlled qualification configuration");
    }
    const forbidden = [
      "MIGRATION_DATABASE_URL",
      "RETENTION_DATABASE_URL",
      "RENDER_API_KEY",
      "NEON_API_KEY",
      "RESEND_API_KEY",
    ];
    const render =
      env.RENDER === "true" &&
      origin.origin === "https://clientelo-experiment.onrender.com" &&
      env.RENDER_EXTERNAL_URL === origin.origin;
    if (
      env.APP_ENV !== "production" ||
      !render ||
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      env.CSRF_TARGET_ORIGIN !== origin.origin ||
      database.pathname !== "/clientelo_native" ||
      decodeURIComponent(database.username) !== "clientelo_native_app" ||
      !database.hostname.endsWith(".neon.tech") ||
      forbidden.some((key) => Boolean(env[key]))
    )
      throw new Error("Unsafe controlled qualification runtime");
    return true;
  }
  if (
    env.APP_ENV !== "test" ||
    !["https://native.clientelo.test", "http://127.0.0.1:4335"].includes(
      env.APP_URL ?? "",
    ) ||
    !env.DATABASE_URL ||
    new URL(env.DATABASE_URL).pathname !== "/clientelo_native_test"
  ) {
    throw new Error(
      "Worksheet controlled mode requires the synthetic local test configuration",
    );
  }
  return true;
}
