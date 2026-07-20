(function () {
  var KEY = "davidcoen_theme";
  var root = document.documentElement;
  var btn = document.getElementById("theme-toggle");

  if (!btn) {
    return;
  }

  var moon = btn.querySelector(".theme-icon-moon");
  var sun = btn.querySelector(".theme-icon-sun");

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
    if (icon) {
      icon.removeAttribute("hidden");
    }
  }

  function hideIcon(icon) {
    if (icon) {
      icon.setAttribute("hidden", "");
    }
  }

  function applyUi(theme) {
    var isDark = theme === "dark";
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light theme" : "Switch to dark theme"
    );
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
    applyUi(effectiveTheme());
  }

  btn.addEventListener("click", function () {
    var next = effectiveTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    root.setAttribute("data-theme", next);
    applyUi(next);
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", function () {
      if (!localStorage.getItem(KEY)) {
        applyUi(effectiveTheme());
      }
    });

  applyStoredTheme();
})();
