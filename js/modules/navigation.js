const MOBILE_NAVIGATION_QUERY = "(max-width: 59.99rem)";

export function initializeNavigation() {
  const header = document.querySelector("[data-site-header]");
  const toggle = document.querySelector("[data-menu-toggle]");
  const navigation = document.querySelector("[data-primary-navigation]");

  if (!header || !toggle || !navigation) {
    return;
  }

  const mediaQuery = window.matchMedia(MOBILE_NAVIGATION_QUERY);

  const setMenuState = (isOpen, { returnFocus = false } = {}) => {
    navigation.dataset.open = String(isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute(
      "aria-label",
      isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación",
    );
    document.body.classList.toggle("has-open-menu", isOpen && mediaQuery.matches);

    if (returnFocus) {
      toggle.focus();
    }
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    setMenuState(!isOpen);
  });

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a") && mediaQuery.matches) {
      setMenuState(false);
    }
  });

  document.addEventListener("click", (event) => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";

    if (isOpen && !header.contains(event.target)) {
      setMenuState(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";

    if (event.key === "Escape" && isOpen) {
      setMenuState(false, { returnFocus: true });
    }
  });

  mediaQuery.addEventListener("change", () => {
    setMenuState(false);
  });

  const currentPage = document.body.dataset.page;

  if (currentPage) {
    const currentLink = navigation.querySelector(
      `[data-nav-page="${currentPage}"]`,
    );

    currentLink?.setAttribute("aria-current", "page");
  }
}
