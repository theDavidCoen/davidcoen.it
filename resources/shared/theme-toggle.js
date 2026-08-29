(function () {
  var KEY = "davidcoen_theme";
  var root = document.documentElement;

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function effectiveTheme() {
    var stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return systemTheme();
  }

  function showIcon(icon) {
    if (icon) icon.removeAttribute("hidden");
  }

  function hideIcon(icon) {
    if (icon) icon.setAttribute("hidden", "");
  }

  function applyUi(btn) {
    var moon = btn.querySelector(".theme-icon-moon");
    var sun = btn.querySelector(".theme-icon-sun");
    var isDark = effectiveTheme() === "dark";
    btn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    btn.setAttribute("title", isDark ? "Light theme" : "Dark theme");
    if (isDark) {
      hideIcon(moon);
      showIcon(sun);
    } else {
      showIcon(moon);
      hideIcon(sun);
    }
  }

  function applyStoredTheme() {
    var stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") {
      root.setAttribute("data-theme", stored);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function bind(btn) {
    if (!btn || btn.dataset.themeBound) return;
    btn.dataset.themeBound = "1";
    applyUi(btn);
    btn.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      localStorage.setItem(KEY, next);
      root.setAttribute("data-theme", next);
      document.querySelectorAll(".theme-toggle").forEach(applyUi);
    });
  }

  function init() {
    applyStoredTheme();
    document.querySelectorAll(".theme-toggle").forEach(bind);
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (!localStorage.getItem(KEY)) {
      document.querySelectorAll(".theme-toggle").forEach(applyUi);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.ResourcesThemeToggle = { init: init };
})();
