import { worksheet } from "../../content/worksheet";
import type { ViewRenderer } from "@getstrata/core/view";
import {
  assertValidSignature,
  hasValidSignature,
  temporarySignedUrl,
} from "@getstrata/core/http/signedUrl";
import { ForbiddenError, ValidationError } from "@getstrata/core/errors/http";
import { comparison } from "../../content/etf-comparison";
import { WorksheetContactRequest } from "./submission";
import { attribution } from "./measurement";
import {
  JourneyRequest,
  isJourneyId,
  observeJourney,
  type JourneyContext,
} from "./journey";
import type { WorksheetStore } from "./store";
import type { AdmissionMode } from "./policy";
import type { PrivacyNotice } from "./runtime";
const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};
const date = (value: string | null) =>
  value ? value.split("-").reverse().map(Number).join(". ") : "datum neuvedeno";
interface ControllerOptions {
  mode?: AdmissionMode;
  formPath?: string;
  resourcePath?: string;
  notice?: PrivacyNotice;
}
function tags(context: JourneyContext): Record<string, string> {
  return context.variant
    ? {
        journey: context.id,
        utm_source: "demo",
        utm_medium: "ad",
        utm_campaign: "etf_compare",
        ad_variant: context.variant,
      }
    : { journey: context.id };
}
function signedContext(request: Request): JourneyContext {
  assertValidSignature(request);
  const query = new URL(request.url).searchParams;
  const id = query.get("journey");
  if (!isJourneyId(id)) throw new ForbiddenError("Unknown journey");
  return { id, variant: attribution(query) };
}
export class WorksheetController {
  private readonly mode: AdmissionMode;
  private readonly formPath: string;
  private readonly resourcePath: string;
  readonly eventsPath: string;
  constructor(
    private readonly views: ViewRenderer,
    private readonly store: WorksheetStore,
    private readonly options: ControllerOptions = {},
  ) {
    this.mode = options.mode ?? "qualification";
    this.formPath = options.formPath ?? "/controlled/contact";
    this.resourcePath = options.resourcePath ?? "/controlled/worksheet";
    this.eventsPath =
      this.formPath === "/etf" ? "/etf/events" : "/controlled/events";
  }
  async form(
    request: Request,
    options: {
      email?: string;
      error?: string;
      resource?: string;
      status?: number;
      isNew?: boolean;
      journey?: JourneyContext;
    } = {},
  ) {
    const resumed =
      request.method === "GET" &&
      hasValidSignature(request) &&
      isJourneyId(new URL(request.url).searchParams.get("journey"))
        ? signedContext(request)
        : undefined;
    const context = options.journey ??
      resumed ?? {
        id: crypto.randomUUID(),
        variant: attribution(new URL(request.url).searchParams),
      };
    const action = temporarySignedUrl(this.formPath, 600, tags(context));
    const response = await this.views.render(
      "etf-comparison.eta",
      {
        data: comparison,
        worksheet,
        date,
        contactEnabled: true,
        qualification: this.mode === "qualification",
        notice: this.options.notice,
        email: options.email ?? "",
        error: options.error ?? "",
        resource: options.resource ?? "",
        action: action + "#contact-step",
        eventsUrl: temporarySignedUrl(this.eventsPath, 600, tags(context)),
        layout: { title: "SPY a VOO: srovnání a pracovní list" },
      },
      {
        request,
        layout: "layouts/etf-content.eta",
        status: options.status ?? 200,
        headers: {
          ...headers,
          ...(options.resource
            ? {
                "X-Worksheet-Accepted": "1",
                "X-Worksheet-New": options.isNew ? "1" : "0",
              }
            : {}),
        },
      },
    );
    if (request.method === "GET" && response.ok)
      await observeJourney(context, "page_response_ready");
    return response;
  }
  async submit(request: Request) {
    const context = signedContext(request);
    await observeJourney(context, "submit_attempt");
    const form = new WorksheetContactRequest(this.mode);
    let email: string;
    try {
      ({ email } = await form.validate(request));
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      await observeJourney(context, "lead_rejected");
      return this.form(request, {
        journey: context,
        email: form.previousEmail,
        error:
          this.mode === "qualification"
            ? "Použijte jednu smyšlenou adresu končící @example.test."
            : "Zkontrolujte e-mail. Zadejte jednu platnou adresu.",
        status: 422,
      });
    }
    try {
      const accepted = await this.store.accept(email, context.variant, context);
      const resource = temporarySignedUrl(this.resourcePath, 600, {
        ...tags(context),
        acceptance: accepted.id,
      });
      return this.form(request, {
        journey: context,
        resource,
        isNew: accepted.isNew,
      });
    } catch {
      return this.form(request, {
        journey: context,
        email,
        error:
          "Přijetí se nepodařilo potvrdit. Adresa zůstává ve formuláři. Zkuste to znovu.",
        status: 503,
      });
    }
  }
  async observeRejection(request: Request) {
    if (hasValidSignature(request)) {
      const id = new URL(request.url).searchParams.get("journey");
      if (isJourneyId(id))
        await observeJourney(
          { id, variant: attribution(new URL(request.url).searchParams) },
          "request_rejected",
        );
    }
  }
  async events(request: Request) {
    const context = signedContext(request);
    const { kind } = await new JourneyRequest().validate(request);
    const acceptance =
      new URL(request.url).searchParams.get("acceptance") ?? undefined;
    if (kind === "resource_visible" || kind === "print_attempt") {
      if (!acceptance) throw new ForbiddenError("Resource acceptance required");
      await this.store.authorize(acceptance);
    }
    await observeJourney(context, kind, acceptance);
    return new Response(null, { status: 204, headers });
  }
  async resource(request: Request) {
    let id: string;
    try {
      assertValidSignature(request);
      id = new URL(request.url).searchParams.get("acceptance") ?? "";
      await this.store.authorize(id);
    } catch (error) {
      if (!(error instanceof ForbiddenError)) throw error;
      return this.views.render(
        "worksheet/access-error.eta",
        { formPath: this.formPath, layout: { title: "Odkaz už neplatí" } },
        {
          request,
          layout: "layouts/etf-content.eta",
          status: 403,
          headers,
        },
      );
    }
    const context = new URL(request.url).searchParams.has("journey")
      ? signedContext(request)
      : undefined;
    const response = await this.views.render(
      "etf-worksheet.eta",
      {
        backUrl: this.formPath,
        backLabel: "Zpět na srovnání",
        data: comparison,
        worksheet,
        date,
        qualification: this.mode === "qualification",
        eventsUrl: context
          ? temporarySignedUrl(this.eventsPath, 600, {
              ...tags(context),
              acceptance: id,
            })
          : undefined,
        layout: { title: "SPY a VOO: pracovní list" },
      },
      { request, layout: "layouts/etf-content.eta", headers },
    );
    if (response.ok) {
      await this.store.open(id);
      if (context) await observeJourney(context, "resource_response_ready", id);
    }
    return response;
  }
}
