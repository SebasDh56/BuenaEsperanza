import { initializeNavigation } from "./modules/navigation.js";
import { initializeGallery } from "./modules/gallery-controller.js";
import { initializePublications } from "./modules/publications-controller.js";

function initializeSite() {
  initializeNavigation();
  initializeGallery();
  initializePublications();

  const year = document.querySelector("[data-current-year]");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSite, { once: true });
} else {
  initializeSite();
}
