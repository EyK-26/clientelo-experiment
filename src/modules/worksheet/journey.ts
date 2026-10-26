import { WebFormRequest } from "@getstrata/core/http/webFormRequest";
import { validateObject } from "@getstrata/core/validation/rules";
import {
  WorksheetJourneyEvent,
  journeyKinds,
  type JourneyKind,
} from "../../models/WorksheetJourneyEvent";
export type JourneyContext = { id: string; variant: "a" | "b" | null };
export function isJourneyId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
  );
}
export async function recordJourney(
  id: string,
  kind: JourneyKind,
  options: { variant?: "a" | "b" | null; acceptanceId?: string } = {},
): Promise<void> {
  if (!isJourneyId(id) || !journeyKinds.includes(kind))
    throw new Error("Unknown journey fact");
  await WorksheetJourneyEvent.repository().upsert(
    {
      id: crypto.randomUUID(),
      journey_id: id,
      kind,
      variant: options.variant ?? null,
      acceptance_id: options.acceptanceId ?? null,
    },
    ["journey_id", "kind"],
    ["kind"],
  );
}
export async function observeJourney(
  context: JourneyContext,
  kind: JourneyKind,
  acceptanceId?: string,
) {
  try {
    await recordJourney(context.id, kind, {
      variant: context.variant,
      acceptanceId,
    });
  } catch {
    console.warn(JSON.stringify({ event: "journey_fact_unrecorded", kind }));
  }
}
const browserKinds = [
  "page_visible",
  "form_engaged",
  "submit_attempt",
  "resource_visible",
  "print_attempt",
] as const;
export class JourneyRequest extends WebFormRequest<{
  kind: (typeof browserKinds)[number];
}> {
  constructor() {
    super({ preserveRepeated: true });
  }
  protected parse(payload: unknown) {
    validateObject(
      { payload },
      {
        payload: [
          (_field, value) =>
            value &&
            typeof value === "object" &&
            Object.keys(value).every((key) => ["kind", "_token"].includes(key))
              ? undefined
              : "Unexpected analytics fields",
        ],
      },
    );
    const parsed = validateObject(payload, {
      kind: [
        (_field, value) =>
          Array.isArray(value) &&
          value.length === 1 &&
          typeof value[0] === "string" &&
          browserKinds.includes(value[0] as (typeof browserKinds)[number])
            ? undefined
            : "Unknown browser event",
      ],
    });
    return { kind: (parsed.kind as (typeof browserKinds)[number][])[0]! };
  }
}
