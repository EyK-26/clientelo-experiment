document
  .querySelector("[data-print-worksheet]")
  ?.addEventListener("click", () => {
    window.worksheetJourney?.("print_attempt");
    window.print();
  });
