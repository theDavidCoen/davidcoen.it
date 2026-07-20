(function () {
  var STORAGE_KEY = "davidcoen_cookie_consent";
  var banner = document.getElementById("cookie-banner");

  if (!banner) {
    return;
  }

  function hideBanner() {
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch (e) {
      /* ignore */
    }
    banner.classList.remove("is-visible");
    banner.setAttribute("hidden", "");
  }

  if (localStorage.getItem(STORAGE_KEY)) {
    banner.setAttribute("hidden", "");
    return;
  }

  banner.classList.add("is-visible");
  banner.removeAttribute("hidden");

  document.getElementById("cookie-dismiss").addEventListener("click", hideBanner);
})();
