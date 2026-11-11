"use strict";

$("html").addClass("js");

// Mobile menu
$(".menu-toggle").on("click", function () {
  const open = $(this).attr("aria-expanded") !== "true";
  $(this).attr("aria-expanded", open).text(open ? "Close −" : "Menu +");
  $(".site-nav").toggleClass("is-open", open);
});
$(".site-nav").on("keydown", function (event) {
  if (event.key === "Escape") {
    $(".menu-toggle").attr("aria-expanded", false).text("Menu +").trigger("focus");
    $(this).removeClass("is-open");
  }
});

// Image viewer
const viewer = document.querySelector("#archive-viewer");
if (viewer) {
  const pictures = $("[data-viewer]").toArray();
  const speed = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 150;
  let pictureIndex = 0;

  function showPicture() {
    const picture = pictures[pictureIndex].dataset;
    $(".dialog-image").attr({ src: picture.image, alt: picture.title });
    $("#viewer-title").text(picture.title);
    $("#viewer-description").text(picture.description);
    $("#viewer-count").text((pictureIndex + 1) + " / " + pictures.length);
  }
  function closeViewer() {
    $(viewer).stop(true, true).fadeOut(speed, function () {
      viewer.close();
      $(viewer).css("display", "");
    });
  }
  function movePicture(step) {
    pictureIndex = (pictureIndex + step + pictures.length) % pictures.length;
    $(".dialog-image").stop(true, true).fadeOut(speed, function () {
      showPicture();
      $(this).fadeIn(speed);
    });
  }
  $(pictures).on("click", function () {
    pictureIndex = pictures.indexOf(this);
    showPicture();
    viewer.showModal();
    $(viewer).hide().fadeIn(speed);
  });
  $(".dialog-close").on("click", closeViewer);
  $("#previous-image").on("click", function () { movePicture(-1); });
  $("#next-image").on("click", function () { movePicture(1); });
  $(viewer).on("cancel", function (event) {
    event.preventDefault();
    closeViewer();
  });
  $(viewer).on("keydown", function (event) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      movePicture(event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  $(viewer).on("click", function (event) {
    const box = viewer.getBoundingClientRect();
    if (event.target === viewer && (event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom)) closeViewer();
  });
}

// Titan records: changes last until the page is reloaded
const titanForm = document.querySelector("#titan-form");
if (titanForm) {
  const titans = [
    { power: "Founding Titan", inheritor: "Eren Yeager", height: "Varies¹", ability: "Commands Titans; influences memories", status: "Restricted access" },
    { power: "Attack Titan", inheritor: "Eren Yeager", height: "15 m", ability: "Close combat; exceptional endurance", status: "Active" },
    { power: "Colossal Titan", inheritor: "Armin Arlert", height: "60 m", ability: "Enormous scale; heat and steam", status: "Active" },
    { power: "Armored Titan", inheritor: "Reiner Braun", height: "15 m", ability: "Hardened armour plates", status: "Active" },
    { power: "Female Titan", inheritor: "Annie Leonhart", height: "14 m", ability: "Agility; hardening", status: "Crystallised" },
    { power: "Beast Titan", inheritor: "Zeke Yeager", height: "17 m", ability: "Long-range throwing", status: "Active" },
    { power: "Jaw Titan", inheritor: "Porco Galliard", height: "5 m", ability: "Speed; powerful jaws and claws", status: "Active" },
    { power: "Cart Titan", inheritor: "Pieck Finger", height: "4 m", ability: "Endurance; mobile support", status: "Active" },
    { power: "War Hammer Titan", inheritor: "Lara Tybur", height: "About 15 m", ability: "Creates hardened weapons", status: "Concealed" }
  ];
  const fields = ["power", "inheritor", "height", "ability", "status"];
  let category = "all";
  let editIndex = -1;

  function renderTable() {
    const query = $("#titan-search").val().trim().toLowerCase();
    const body = $("#titan-rows").empty();
    let count = 0;
    titans.forEach(function (titan, index) {
      const text = fields.map(function (field) { return titan[field]; }).join(" ").toLowerCase();
      const group = titan.status === "Active" ? "active" : "other";
      if (!text.includes(query) || (category !== "all" && category !== group)) return;
      const row = $("<tr>");
      fields.forEach(function (field, column) {
        const cell = column === 0 ? $("<th>").attr("scope", "row") : $("<td>");
        row.append(cell.text(titan[field]));
      });
      const actions = $("<td>").addClass("row-actions");
      actions.append($("<button>").attr("type", "button").addClass("btn edit-titan").data("index", index).text("Edit"));
      actions.append($("<button>").attr("type", "button").addClass("btn delete-titan").data("index", index).text("Delete"));
      body.append(row.append(actions));
      count++;
    });
    $("#record-count").text(count + " of " + titans.length + " records");
    $("#no-records").prop("hidden", count !== 0);
  }
  function resetEditor() {
    editIndex = -1;
    titanForm.reset();
    $("#save-titan").text("Add Titan");
    $("#cancel-edit").prop("hidden", true);
  }
  $("#titan-search").on("input", renderTable);
  $("[data-category]").on("click", function () {
    category = $(this).data("category");
    $("[data-category]").removeClass("active").attr("aria-pressed", false);
    $(this).addClass("active").attr("aria-pressed", true);
    renderTable();
  });
  $(titanForm).on("input change", function () {
    $(this).find("input").each(function () { this.setCustomValidity(""); });
  });
  $(titanForm).on("submit", function (event) {
    event.preventDefault();
    const record = {};
    fields.forEach(function (field) {
      const input = titanForm.elements.namedItem(field);
      record[field] = input.value.trim();
      input.setCustomValidity(record[field] ? "" : "Please fill in this field.");
    });
    if (!titanForm.reportValidity()) return;
    if (editIndex === -1) titans.push(record);
    else titans[editIndex] = record;
    $("#table-status").text(editIndex === -1 ? "Record added." : "Record updated.");
    resetEditor();
    $("#titan-search").val("");
    $("[data-category='all']").trigger("click");
  });
  $("#titan-rows").on("click", ".edit-titan", function () {
    editIndex = $(this).data("index");
    fields.forEach(function (field) {
      titanForm.elements.namedItem(field).value = titans[editIndex][field];
      titanForm.elements.namedItem(field).setCustomValidity("");
    });
    $("#titan-editor").prop("open", true);
    $("#save-titan").text("Save changes");
    $("#cancel-edit").prop("hidden", false);
    titanForm.elements.namedItem("power").focus();
  });
  $("#titan-rows").on("click", ".delete-titan", function () {
    const index = $(this).data("index");
    if (!confirm("Delete " + titans[index].power + "?")) return;
    titans.splice(index, 1);
    resetEditor();
    renderTable();
    $("#table-status").text("Record deleted.");
  });
  $("#cancel-edit").on("click", resetEditor);
  renderTable();
}

// Registration form
const recruitForm = document.querySelector("#recruit-form");
if (recruitForm) {
  const fields = $(recruitForm).find(".form-control, .form-select").toArray();
  const password = recruitForm.elements.namedItem("password");
  const confirmation = recruitForm.elements.namedItem("confirmation");
  let recruitCard = "";
  $("#create-card").prop("disabled", false);

  function checkField(input) {
    let error = "";
    const value = input.value.trim();
    if (!value) error = "Please fill in this field.";
    else if (input.name === "name" && value.length < 2) error = "Enter at least 2 characters.";
    else if (input.name === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = "Enter a valid email, like scout@example.com.";
    else if (input.name === "password" && input.value.length < 8) error = "Use at least 8 characters.";
    else if (input.name === "confirmation" && input.value !== password.value) error = "Passwords do not match.";
    else if (input.name === "message" && value.length < 10) error = "Write at least 10 characters.";
    input.setCustomValidity(error);
    const valid = input.checkValidity();
    $(input).toggleClass("is-invalid", !valid).toggleClass("is-valid", valid).attr("aria-invalid", !valid);
    $("#" + input.id + "-feedback").text(valid ? "Looks good." : (error || input.validationMessage))
      .toggleClass("error", !valid).toggleClass("success", valid);
    return valid;
  }
  $(fields).on("input change", function () {
    checkField(this);
    if (this === password) {
      const value = password.value;
      const types = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(function (rule) { return rule.test(value); }).length;
      let strength = value ? 1 : 0;
      if (value.length >= 8 && types >= 2) strength = 2;
      if (value.length >= 10 && types === 4) strength = 3;
      $("#password-meter").val(strength);
      $("#password-strength").text(["Use 8+ characters. Mix letters, numbers and symbols.", "Weak", "Medium", "Strong"][strength]);
      if (confirmation.value) checkField(confirmation);
    }
  });
  $(recruitForm).on("input change", function () {
    $("#form-status, #form-error").prop("hidden", true);
    recruitCard = "";
  });
  $(recruitForm).on("submit", function (event) {
    event.preventDefault();
    fields.forEach(checkField);
    if (!recruitForm.reportValidity()) {
      $("#form-error").prop("hidden", false);
      return;
    }
    const name = recruitForm.elements.namedItem("name").value.trim();
    const regiment = recruitForm.elements.namedItem("regiment").value;
    $("#recruit-name").text(name);
    $("#recruit-regiment").text(regiment);
    recruitCard = "SURVEY CORPS RECRUIT CARD\nName: " + name + "\nRegiment: " + regiment + "\n\nUnofficial fan activity.";
    $("#form-status").prop("hidden", false).trigger("focus");
  });
  $(recruitForm).on("reset", function () {
    fields.forEach(function (input) {
      input.setCustomValidity("");
      $(input).removeClass("is-valid is-invalid").removeAttr("aria-invalid");
    });
    $(".field-feedback").text("").removeClass("error success");
    $("#password-meter").val(0);
    $("#password-strength").text("Use 8+ characters. Mix letters, numbers and symbols.");
    $("#form-status, #form-error").prop("hidden", true);
    recruitCard = "";
  });
  $("#download-card").on("click", function () {
    if (!recruitCard) return;
    const url = URL.createObjectURL(new Blob([recruitCard], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "survey-corps-recruit-card.txt";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
}
