import {
  isSyntheticMailbox,
  normalizeContactEmail,
  type AdmissionMode,
} from "./policy";
import { WebFormRequest } from "@getstrata/core/http/webFormRequest";
import {
  validateObject,
  type ValidationRule,
} from "@getstrata/core/validation/rules";
const single: ValidationRule = (_field, value) =>
  Array.isArray(value) && value.length === 1 && typeof value[0] === "string"
    ? undefined
    : "Zadejte jednu e-mailovou adresu.";
export class WorksheetContactRequest extends WebFormRequest<{ email: string }> {
  previousEmail = "";
  constructor(private readonly mode: AdmissionMode = "qualification") {
    super({ preserveRepeated: true });
  }
  protected parse(payload: unknown) {
    const fields = validateObject(payload, { email: [single] });
    const raw = (fields.email as string[])[0]!;
    this.previousEmail = raw.slice(0, 254);
    const email = normalizeContactEmail(raw);
    if (this.mode === "qualification")
      validateObject(
        { email },
        {
          email: [
            (_field, value) =>
              isSyntheticMailbox(value)
                ? undefined
                : "Použijte smyšlenou adresu končící @example.test.",
          ],
        },
      );
    return { email };
  }
}
