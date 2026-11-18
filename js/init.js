"use strict";

// Restore the saved theme and profile before the page is drawn.
(function () {
  const root = document.documentElement;
  let theme = "dark";
  let user = null;
  root.classList.add("js");
  try {
    theme = localStorage.getItem("sca-theme") === "light" ? "light" : "dark";
    user = JSON.parse(localStorage.getItem("sca-user") || "null");
  } catch (error) {}
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-auth", user && user.name ? "in" : "out");
})();
