"use strict";

document.documentElement.classList.add("js");

// The navigation remains visible when JavaScript is unavailable.
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
menuButton?.addEventListener("click", () => {
  const expanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!expanded));
  menuButton.textContent = expanded ? "Menu +" : "Close −";
  navigation.classList.toggle("is-open", !expanded);
});
navigation?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "Menu +";
    navigation.classList.remove("is-open");
    menuButton.focus();
  }
});

// One accessible native dialog serves both character dossiers and stills.
const viewer = document.querySelector("#archive-viewer");
let previousTrigger;
if (viewer) {
  const image = viewer.querySelector(".dialog-image");
  document.querySelectorAll("[data-viewer]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      previousTrigger = trigger;
      image.src = trigger.dataset.image;
      image.alt = trigger.dataset.title;
      viewer.querySelector("#viewer-title").textContent = trigger.dataset.title;
      viewer.querySelector("#viewer-description").textContent =
        trigger.dataset.description;
      viewer.showModal();
    });
  });
  viewer
    .querySelector(".dialog-close")
    .addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (event) => {
    if (event.target !== viewer) return;
    const rect = viewer.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      viewer.close();
  });
  viewer.addEventListener("close", () => previousTrigger?.focus());
}

// Search only the visible nine-record table. Empty results get a clear message.
const titanSearch = document.querySelector("#titan-search");
if (titanSearch) {
  const rows = [...document.querySelectorAll(".titan-table tbody tr")];
  titanSearch.addEventListener("input", () => {
    const query = titanSearch.value.trim().toLowerCase();
    let count = 0;
    rows.forEach((row) => {
      const matches = row.textContent.toLowerCase().includes(query);
      row.hidden = !matches;
      if (matches) count += 1;
    });
    document.querySelector("#record-count").textContent =
      `${count} of 9 records`;
    document.querySelector("#no-records").hidden = count !== 0;
  });
}

// This is an explicitly labelled fan activity: nothing is sent to a server.
const recruitForm = document.querySelector("#recruit-form");
let recruitCard = "";
if (recruitForm) {
  document.querySelector("#create-card").disabled = false;
  const status = document.querySelector("#form-status");
  recruitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameInput = recruitForm.elements.namedItem("name");
    const name = nameInput.value.trim();
    const message = recruitForm.elements.namedItem("message");
    nameInput.setCustomValidity(
      name.length < 2 ? "Please enter at least 2 non-space characters." : "",
    );
    message.setCustomValidity(
      message.value.trim().length < 10
        ? "Please enter at least 10 non-space characters."
        : "",
    );
    if (!recruitForm.reportValidity()) return;
    const regiment = recruitForm.elements.namedItem("regiment").value;
    document.querySelector("#recruit-name").textContent = name;
    document.querySelector("#recruit-regiment").textContent = regiment;
    recruitCard = `SURVEY CORPS ARCHIVE\nFAN RECRUIT CARD\n\nName: ${name}\nRegiment: ${regiment}\n\nShinzou wo Sasageyo!\n\nA fictional fan activity. No application was sent.\n`;
    status.hidden = false;
    status.focus();
  });
  recruitForm.addEventListener("input", () => {
    recruitForm.elements.namedItem("name").setCustomValidity("");
    recruitForm.elements.namedItem("message").setCustomValidity("");
    status.hidden = true;
    recruitCard = "";
  });
  recruitForm.addEventListener("reset", () => {
    recruitForm.elements.namedItem("name").setCustomValidity("");
    recruitForm.elements.namedItem("message").setCustomValidity("");
    status.hidden = true;
    recruitCard = "";
  });
  document.querySelector("#download-card").addEventListener("click", () => {
    if (!recruitCard) return;
    const blob = new Blob([recruitCard], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "survey-corps-recruit-card.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
