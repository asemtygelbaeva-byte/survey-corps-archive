"use strict";

// Sign-in state (saved in localStorage)
function getUser() {
  const raw = store.get(KEYS.user);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    if (user && typeof user.name === "string" && user.name && typeof user.email === "string") return user;
  } catch (error) { /* damaged value: treat as signed out */ }
  return null;
}
function favoritesKey(user) { return "sca-favorites:" + user.email; }
function getFavorites() {
  const user = getUser();
  if (!user) return [];
  try {
    const list = JSON.parse(store.get(favoritesKey(user)) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (error) { return []; }
}
function setFavorites(list) {
  const user = getUser();
  if (user) store.set(favoritesKey(user), JSON.stringify(list));
}
function renderAuth() {
  const user = getUser();
  document.documentElement.setAttribute("data-auth", user ? "in" : "out");
  $("[data-user-name]").text(user ? user.name : "");
  $("[data-user-email]").text(user ? user.email : "");
  $("[data-user-since]").text(user && user.signedInAt ? new Date(user.signedInAt).toLocaleString() : "");
  $("[data-user-favorites]").text(getFavorites().length);
  $(document).trigger("sca:auth");
}
function signOut() {
  store.remove(KEYS.user);
  renderAuth();
  $("#signout-status").prop("hidden", false);
}
renderAuth();
$(document).on("click", "[data-signout]", signOut);

// Keep several open tabs in sync
window.addEventListener("storage", function (event) {
  if (event.key === KEYS.theme) applyTheme(event.newValue === "light" ? "light" : "dark");
  if (event.key === KEYS.user) renderAuth();
});

// Shared with js/characters.js
window.SCA = { store: store, getUser: getUser, getFavorites: getFavorites, setFavorites: setFavorites };

// Sign-in form
const signinForm = document.querySelector("#signin-form");
if (signinForm) {
  const rules = {
    name: function (value) {
      if (!value) return "Please enter a display name.";
      if (value.length < 2) return "Enter at least 2 characters.";
      return "";
    },
    email: function (value) {
      if (!value) return "Please enter your email.";
      if (!EMAIL_PATTERN.test(value)) return "Enter a valid email, like scout@example.com.";
      return "";
    },
    password: function (value) {
      if (!value) return "Please enter a password.";
      if (value.length < 8) return "Use at least 8 characters.";
      if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return "Include at least one letter and one number.";
      return "";
    }
  };
  function checkSigninField(input) {
    const value = input.name === "password" ? input.value : input.value.trim();
    const error = rules[input.name](value);
    input.setCustomValidity(error);
    const valid = !error;
    $(input).toggleClass("is-invalid", !valid).toggleClass("is-valid", valid).attr("aria-invalid", !valid);
    $("#" + input.id + "-feedback").text(valid ? "Looks good." : error)
      .toggleClass("error", !valid).toggleClass("success", valid);
    return valid;
  }
  const signinFields = $(signinForm).find(".form-control").toArray();
  $(signinFields).on("input blur", function () { checkSigninField(this); });
  $("#show-password").on("change", function () {
    $("#signin-password").attr("type", this.checked ? "text" : "password");
  });
  $(signinForm).on("submit", function (event) {
    event.preventDefault();
    const results = signinFields.map(checkSigninField);
    if (results.indexOf(false) !== -1) {
      $("#signin-error").prop("hidden", false);
      $(signinFields.filter(function (input) { return !input.checkValidity(); })[0]).trigger("focus");
      return;
    }
    $("#signin-error").prop("hidden", true);
    // Only non-sensitive data is stored. The password is never saved.
    const user = {
      name: signinForm.elements.namedItem("name").value.trim(),
      email: signinForm.elements.namedItem("email").value.trim().toLowerCase(),
      signedInAt: new Date().toISOString()
    };
    if (!store.set(KEYS.user, JSON.stringify(user))) {
      $("#signin-error").text("Your browser blocked saving the sign-in. Enable site data and try again.").prop("hidden", false);
      return;
    }
    signinForm.reset();
    signinFields.forEach(function (input) {
      input.setCustomValidity("");
      $(input).removeClass("is-valid is-invalid").removeAttr("aria-invalid");
    });
    $(".field-feedback", signinForm).text("").removeClass("error success");
    $("#signout-status").prop("hidden", true);
    renderAuth();
    $("#auth-status").text("Welcome, " + user.name + "! You are now signed in.").trigger("focus");
  });
}

// FAQ accordion (jQuery slideToggle)
$(".faq-question").on("click", function () {
  const button = $(this);
  const answer = $("#" + button.attr("aria-controls"));
  const opening = button.attr("aria-expanded") !== "true";
  button.attr("aria-expanded", opening).toggleClass("is-open", opening);
  button.find(".faq-icon").text(opening ? "−" : "+");
  answer.stop(true, true).slideToggle(reducedMotion ? 0 : 300);
});

// Registration form
const recruitForm = document.querySelector("#recruit-form");
if (recruitForm) {
  const fields = $(recruitForm).find(".form-control, .form-select").toArray();
  const password = recruitForm.elements.namedItem("password");
  const confirmation = recruitForm.elements.namedItem("confirmation");
  let recruitCard = "";
  $("#create-card").prop("disabled", false);

  // Signed-in users get their name and email filled in
  function prefillFromAccount() {
    const user = getUser();
    if (!user) return;
    const nameInput = recruitForm.elements.namedItem("name");
    const emailInput = recruitForm.elements.namedItem("email");
    if (!nameInput.value) nameInput.value = user.name;
    if (!emailInput.value) emailInput.value = user.email;
  }
  prefillFromAccount();
  $(document).on("sca:auth", prefillFromAccount);

  function checkField(input) {
    let error = "";
    const value = input.value.trim();
    if (!value) error = "Please fill in this field.";
    else if (input.name === "name" && value.length < 2) error = "Enter at least 2 characters.";
    else if (input.name === "email" && !EMAIL_PATTERN.test(value)) error = "Enter a valid email, like scout@example.com.";
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
