import { initializeNavigation } from "./modules/navigation.js";
import { initializeGallery } from "./modules/gallery-controller.js";
import { initializeGalleryPreview } from "./modules/gallery-preview.js";
import { initializeLatestAnnouncement } from "./modules/latest-announcement.js";
import { initializeProposalForm } from "./modules/proposal-controller.js";
import { initializePublications } from "./modules/publications-controller.js";

function initializeSite() {
  initializeNavigation();
  initializeGallery();
  initializeGalleryPreview();
  initializeProposalForm();
  initializePublications();
  initializeLatestAnnouncement();

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
