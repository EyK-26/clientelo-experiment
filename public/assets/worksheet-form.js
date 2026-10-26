// Progressive enhancement; native form rendering, validation and CSRF remain authoritative.
const form = document.querySelector("[data-controlled-contact]");
if (form)
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    window.worksheetJourney?.("submit_attempt");
    const button = form.querySelector("button");
    const status = document.getElementById("form-status");
    const email = form.querySelector('[name="email"]');
    email.removeAttribute("aria-invalid");
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.textContent =
      "Čekáme na potvrzení uložení. Adresa zůstává ve formuláři.";
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
        signal: AbortSignal.timeout(10000),
      });
      const result = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      if (response.ok && response.headers.get("X-Worksheet-Accepted") === "1") {
        const accepted = result.getElementById("contact-step");
        if (!accepted?.querySelector("#worksheet-access"))
          throw new Error("Missing resource");
        document.getElementById("contact-step").replaceWith(accepted);
        accepted.querySelector("h2").focus();
        return;
      }
      email.setAttribute("aria-invalid", "true");
      status.textContent =
        result.getElementById("form-status")?.textContent ||
        "Přijetí není potvrzené. Adresa zůstává ve formuláři. Zkuste to znovu.";
      if (response.status === 403) {
        // Obtain the server's native form and token again; never generate or read a cookie in JS.
        const refreshUrl = new URL(form.action);
        refreshUrl.hash = "";
        const refreshed = await fetch(refreshUrl, {
          credentials: "same-origin",
          signal: AbortSignal.timeout(10000),
        });
        if (refreshed.ok) {
          const page = new DOMParser().parseFromString(
            await refreshed.text(),
            "text/html",
          );
          const renewed = page.querySelector("[data-controlled-contact]");
          if (renewed) {
            const nextJourney = page.getElementById("worksheet-journey");
            const currentJourney = document.getElementById("worksheet-journey");
            if (nextJourney && currentJourney) {
              currentJourney.dataset.journeyEvents =
                nextJourney.dataset.journeyEvents;
              currentJourney.dataset.csrf = nextJourney.dataset.csrf;
            }
            form.action = renewed.getAttribute("action");
            form.querySelector('[name="_token"]').value =
              renewed.querySelector('[name="_token"]').value;
            status.textContent =
              "Formulář jsme obnovili. Adresa zůstala vyplněná; zkuste žádost znovu odeslat.";
          }
        }
      }
      status.focus();
    } catch {
      status.textContent =
        "Přijetí se nepodařilo potvrdit. Adresa zůstává ve formuláři. Zkuste to znovu; opakování nevytvoří druhý záznam.";
      status.focus();
    } finally {
      button.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
