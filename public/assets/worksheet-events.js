// Optional browser observations. No email, URL, IP, localStorage or analytics cookie payload.
const journey = document.getElementById("worksheet-journey");
if (journey) {
  window.worksheetJourney = (kind) => {
    const body = new FormData();
    body.set("_token", journey.dataset.csrf);
    body.set("kind", kind);
    return fetch(journey.dataset.journeyEvents, {
      method: "POST",
      body,
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  };
  window.worksheetJourney(
    journey.dataset.resource === "1" ? "resource_visible" : "page_visible",
  );
  document
    .querySelector('[name="email"]')
    ?.addEventListener("input", () => window.worksheetJourney("form_engaged"), {
      once: true,
    });
}
