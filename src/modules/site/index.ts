import { worksheet } from "../../content/worksheet";
import { worksheetRuntime } from "../worksheet/runtime";
import type { AppModule } from "@getstrata/bootstrap/contracts";
import { CORE_VIEW_RENDERER_TOKEN } from "@getstrata/core/view";
import { assertComparison, comparison } from "../../content/etf-comparison";
const site: AppModule = {
  name: "site",
  order: 1,
  webRoutes({ kernel, dependencies }) {
    const views = dependencies.container.resolve(CORE_VIEW_RENDERER_TOKEN);
    const preview = kernel.wrapPublicDocument((request: Request) => {
      assertComparison(comparison);
      return views.render(
        "etf-comparison.eta",
        {
          data: comparison,
          worksheet,
          date: (value: string | null) =>
            value
              ? value.split("-").reverse().map(Number).join(". ")
              : "datum neuvedeno",
          layout: { title: "SPY a VOO: srovnání" },
        },
        {
          request,
          layout: "layouts/etf-content.eta",
          headers: {
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        },
      );
    });
    return {
      "/etf-preview": { GET: preview },
      "/": {
        GET: kernel.wrapPublicDocument(() =>
          Response.redirect(new URL("/etf", process.env.APP_URL), 302),
        ),
      },
      ...(worksheetRuntime(process.env).mode === "disabled"
        ? { "/etf": { GET: preview } }
        : {}),
    };
  },
};
export default site;
