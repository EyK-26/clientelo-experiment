import {
  emailRule,
  maxLength,
  required,
  stringRule,
  validateObject,
} from "@getstrata/core/validation/rules";

export type AdmissionMode = "qualification" | "public";

// Product identity validation. This does not verify ownership of an address.
export function normalizeContactEmail(input: string): string {
  const email = input.trim().toLowerCase();
  validateObject(
    { email },
    {
      email: [
        required(),
        stringRule(),
        maxLength(254),
        emailRule(),
        (_field, value) => {
          const local = String(value).split("@")[0] ?? "";
          const domain = String(value).split("@")[1] ?? "";
          return local.length > 64 ||
            local.startsWith(".") ||
            local.endsWith(".") ||
            local.includes("..") ||
            domain
              .split(".")
              .some(
                (label) =>
                  !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
              )
            ? "Zkontrolujte e-mailovou adresu."
            : undefined;
        },
      ],
    },
  );
  return email;
}

export function isSyntheticMailbox(value: unknown): value is string {
  if (typeof value !== "string" || !value.endsWith("@example.test"))
    return false;
  const local = value.slice(0, -"@example.test".length);
  return (
    /^[a-z0-9][a-z0-9.-]{0,63}$/.test(local) &&
    !local.endsWith(".") &&
    !local.includes("..")
  );
}
