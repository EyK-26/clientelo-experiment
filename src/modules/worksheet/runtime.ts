import { appProfile } from "../../bootstrap/appProfile";
import { controlledWorksheetEnabled } from "./measurement";

export interface PrivacyNotice {
  operator: string;
  privacyContact: string;
  purpose: string;
  access: string;
  retention: string;
  deletionOwner: string;
  legalBasis: string;
}
export type WorksheetRuntime =
  | { mode: "disabled"; notice?: never }
  | { mode: "qualification"; notice?: never }
  | { mode: "public"; notice: PrivacyNotice };

// Release interlocks do not establish a legal basis. An actual review must precede enabling them.
export function worksheetRuntime(
  env: Record<string, string | undefined>,
): WorksheetRuntime {
  if (env.WORKSHEET_PUBLIC_COLLECTION === "1") {
    if (
      appProfile(env) !== "worksheet-product" ||
      env.APP_ENV !== "production" ||
      env.WORKSHEET_RELEASE_APPROVED !== "1" ||
      env.WORKSHEET_RETENTION_VERIFIED !== "1"
    )
      throw new Error(
        "Public collection requires identity, legal and retention release review",
      );
    const forbidden = [
      "MIGRATION_DATABASE_URL",
      "RETENTION_DATABASE_URL",
      "RENDER_API_KEY",
      "NEON_API_KEY",
      "RESEND_API_KEY",
    ];
    if (forbidden.some((key) => Boolean(env[key])))
      throw new Error(
        "Administration/mail credentials cannot enter product runtime",
      );
    const origin = new URL(env.APP_URL!);
    const database = new URL(env.DATABASE_URL!);
    if (
      origin.protocol !== "https:" ||
      origin.origin !== env.CSRF_TARGET_ORIGIN ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      origin.username ||
      origin.password ||
      database.pathname !== "/clientelo_native" ||
      decodeURIComponent(database.username) !== "clientelo_native_app"
    )
      throw new Error("Unsafe public worksheet runtime");
    const notice = JSON.parse(
      env.PRIVACY_NOTICE_JSON ?? "null",
    ) as PrivacyNotice | null;
    for (const key of [
      "operator",
      "privacyContact",
      "purpose",
      "access",
      "retention",
      "deletionOwner",
      "legalBasis",
    ] as const)
      if (!notice || typeof notice[key] !== "string" || !notice[key].trim())
        throw new Error("Complete reviewed privacy notice required");
    return { mode: "public", notice: notice! };
  }
  return {
    mode: controlledWorksheetEnabled(env) ? "qualification" : "disabled",
  };
}
