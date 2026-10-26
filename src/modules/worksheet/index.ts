import { withMiddleware } from "@getstrata/core/http/routeMiddleware";
import {
  createServiceToken,
  type AppModule,
} from "@getstrata/bootstrap/contracts";
import { CORE_VIEW_RENDERER_TOKEN } from "@getstrata/core/view";
import { worksheetRuntime } from "./runtime";
import { WorksheetStore } from "./store";
import { WorksheetController } from "./controller";
export const WORKSHEET_STORE = createServiceToken<WorksheetStore>(
  "worksheet.controlled.store",
);
const runtime = worksheetRuntime(process.env);
const enabled = runtime.mode !== "disabled";
const worksheetModule: AppModule = {
  name: "worksheet",
  providers: enabled
    ? [
        {
          name: "worksheet.controlled",
          register({ container }) {
            container.set(WORKSHEET_STORE, new WorksheetStore());
          },
        },
      ]
    : [],
  webRoutes({ kernel, dependencies }) {
    if (!enabled) return {};
    const container = dependencies.container;
    const controller = new WorksheetController(
      container.resolve(CORE_VIEW_RENDERER_TOKEN),
      container.resolve(WORKSHEET_STORE),
    );
    const product = new WorksheetController(
      container.resolve(CORE_VIEW_RENDERER_TOKEN),
      container.resolve(WORKSHEET_STORE),
      {
        mode: runtime.mode === "public" ? "public" : "qualification",
        formPath: "/etf",
        resourcePath: "/worksheet",
        notice: runtime.notice,
      },
    );
    const submit = (controller: WorksheetController) =>
      withMiddleware(async (request, next) => {
        const response = await next();
        // Observe native rejection; never alter the status, token, cookie or origin rules.
        if (response.status === 403) await controller.observeRejection(request);
        return response;
      })(kernel.wrapWeb((request) => controller.submit(request)));
    return {
      "/etf": {
        GET: kernel.wrapWeb((request) => product.form(request)),
        POST: submit(product),
      },
      "/worksheet": {
        GET: kernel.wrapWeb((request) => product.resource(request)),
      },
      "/etf/events": {
        POST: kernel.wrapWeb((request) => product.events(request)),
      },
      ...(runtime.mode === "qualification"
        ? {
            "/controlled/contact": {
              GET: kernel.wrapWeb((request) => controller.form(request)),
              POST: submit(controller),
            },
            "/controlled/events": {
              POST: kernel.wrapWeb((request) => controller.events(request)),
            },
            "/controlled/worksheet": {
              GET: kernel.wrapWeb((request) => controller.resource(request)),
            },
          }
        : {}),
    };
  },
};
export default worksheetModule;
