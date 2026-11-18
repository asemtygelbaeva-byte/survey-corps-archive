"use strict";

// Titan records (saved in localStorage)
const titanForm = document.querySelector("#titan-form");
if (titanForm) {
  const defaultTitans = [
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
  const copyTitans = function (list) {
    return list.map(function (item) { return Object.assign({}, item); });
  };
  function loadTitans() {
    const raw = store.get(KEYS.titans);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        const valid = Array.isArray(saved) && saved.every(function (item) {
          return item && fields.every(function (field) { return typeof item[field] === "string" && item[field]; });
        });
        if (valid) return saved;
      } catch (error) { /* fall back to the original records */ }
    }
    return copyTitans(defaultTitans);
  }
  function saveTitans() {
    if (!store.set(KEYS.titans, JSON.stringify(titans))) {
      $("#table-status").text("Changes could not be saved in this browser.");
    }
  }
  let titans = loadTitans();
  let category = "all";
  let editIndex = -1;

  // Confirmation dialog (replaces the browser's confirm box)
  const confirmDialog = document.querySelector("#confirm-dialog");
  function askConfirm(title, text, okLabel) {
    if (!confirmDialog || typeof confirmDialog.showModal !== "function") {
      return Promise.resolve(window.confirm(text));
    }
    return new Promise(function (resolve) {
      $("#confirm-title").text(title);
      $("#confirm-text").text(text);
      $("#confirm-ok").text(okLabel);
      const finish = function (answer) {
        $("#confirm-ok, #confirm-cancel, #confirm-dialog").off(".confirm");
        confirmDialog.close();
        resolve(answer);
      };
      $("#confirm-ok").on("click.confirm", function () { finish(true); });
      $("#confirm-cancel").on("click.confirm", function () { finish(false); });
      $(confirmDialog).on("cancel.confirm", function (event) {
        event.preventDefault();
        finish(false);
      });
      confirmDialog.showModal();
      $("#confirm-cancel").trigger("focus");
    });
  }

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
      actions.append($("<button>").attr({ type: "button", "aria-label": "Edit " + titan.power }).addClass("btn edit-titan").data("index", index).text("Edit"));
      actions.append($("<button>").attr({ type: "button", "aria-label": "Delete " + titan.power }).addClass("btn delete-titan").data("index", index).text("Delete"));
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
    saveTitans();
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
  $("#titan-rows").on("click", ".delete-titan", async function () {
    const index = $(this).data("index");
    const name = titans[index].power;
    const confirmed = await askConfirm("Delete record?", "Delete “" + name + "” from the Titan table? You can restore the original records later.", "Delete");
    if (!confirmed) return;
    titans.splice(index, 1);
    saveTitans();
    resetEditor();
    renderTable();
    $("#table-status").text("Record deleted.");
  });
  $("#reset-titans").on("click", async function () {
    const confirmed = await askConfirm("Restore original records?", "Your added, edited and deleted records will be replaced by the original nine.", "Restore");
    if (!confirmed) return;
    titans = copyTitans(defaultTitans);
    store.remove(KEYS.titans);
    resetEditor();
    $("#titan-search").val("");
    $("[data-category='all']").trigger("click");
    $("#table-status").text("Original records restored.");
  });
  $("#cancel-edit").on("click", resetEditor);
  renderTable();
}
