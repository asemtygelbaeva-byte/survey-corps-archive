"use strict";

$("html").addClass("js");

// Shared helpers
// localStorage can throw (private mode, blocked data), so every access is wrapped.
const store = {
  get: function (key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  },
  set: function (key, value) {
    try { localStorage.setItem(key, value); return true; } catch (error) { return false; }
  },
  remove: function (key) {
    try { localStorage.removeItem(key); } catch (error) { /* ignore */ }
  }
};
const KEYS = { theme: "sca-theme", user: "sca-user", titans: "sca-titans" };
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Light / dark theme (saved in localStorage)
function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  $("meta[name='theme-color']").attr("content", theme === "light" ? "#fffaf0" : "#1e392a");
  const next = theme === "light" ? "dark" : "light";
  $(".theme-toggle")
    .attr("aria-label", "Switch to " + next + " theme")
    .find(".theme-icon").text(next === "light" ? "☀" : "☾").end()
    .find(".theme-label").text(next === "light" ? "Light" : "Dark");
}
applyTheme(currentTheme());
$(".theme-toggle").on("click", function () {
  const theme = currentTheme() === "light" ? "dark" : "light";
  store.set(KEYS.theme, theme);
  applyTheme(theme);
});

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
  const speed = reducedMotion ? 0 : 150;
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
