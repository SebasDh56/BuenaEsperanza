import {
  getAuthorizedContext,
  loginUrlForCurrentPage,
  signOutCurrentSession,
} from "./modules/auth.js";
import { getAuthenticatedSupabaseClient } from "./config/supabase-client.js";
import { showNotification } from "./modules/notifications.js";

function initializeAdminMenu() {
  const toggle = document.querySelector("[data-admin-menu-toggle]");
  const sidebar = document.querySelector("[data-admin-sidebar]");

  if (!toggle || !sidebar) {
    return;
  }

  toggle.addEventListener("click", () => {
    const isOpen = sidebar.dataset.open === "true";
    sidebar.dataset.open = String(!isOpen);
    toggle.setAttribute("aria-expanded", String(!isOpen));
    toggle.setAttribute(
      "aria-label",
      isOpen ? "Abrir menú administrativo" : "Cerrar menú administrativo",
    );
  });
}

function populateAccount(context) {
  const displayName =
    context.profile.nombre?.trim() || context.user.email || "Usuario";
  const roleLabel =
    context.profile.rol === "administrador" ? "Administrador" : "Editor";

  for (const element of document.querySelectorAll("[data-admin-user-name]")) {
    element.textContent = displayName;
  }

  for (const element of document.querySelectorAll("[data-admin-user-role]")) {
    element.textContent = roleLabel;
  }

  const activePage = document.body.dataset.adminPage;

  for (const link of document.querySelectorAll("[data-admin-nav]")) {
    if (link.dataset.adminNav === activePage) {
      link.setAttribute("aria-current", "page");
    }
  }
}

function initializeSignOut() {
  const buttons = document.querySelectorAll("[data-admin-sign-out]");

  for (const button of buttons) {
    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await signOutCurrentSession();
        window.location.replace("/admin/login.html");
      } catch {
        button.disabled = false;
        const notification = document.querySelector(
          "[data-admin-global-notification]",
        );
        showNotification(
          notification,
          "No se pudo cerrar la sesión. Inténtalo nuevamente.",
          "error",
        );
      }
    });
  }
}

function listenForSignedOutSession() {
  const client = getAuthenticatedSupabaseClient();

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      window.location.replace("/admin/login.html");
    }
  });
}

async function initializeProtectedPage() {
  const accessError = document.querySelector("[data-admin-access-error]");

  try {
    const context = await getAuthorizedContext();

    if (!context) {
      window.location.replace(loginUrlForCurrentPage());
      return;
    }

    populateAccount(context);
    initializeAdminMenu();
    initializeSignOut();
    listenForSignedOutSession();
    document.body.classList.add("admin-auth-ready");

    const pageModules = {
      dashboard: () => import("./pages/admin-dashboard.js"),
      editor: () => import("./pages/admin-editor.js"),
      publicaciones: () => import("./pages/admin-publications.js"),
    };
    const loadPage = pageModules[document.body.dataset.adminPage];

    if (!loadPage) {
      throw new Error("La página administrativa no está configurada.");
    }

    const page = await loadPage();
    await page.initialize(context);
  } catch (error) {
    document.body.classList.add("admin-auth-ready");
    showNotification(
      accessError,
      error?.message ||
        "No se pudo verificar el acceso al panel administrativo.",
      "error",
    );
  }
}

async function initializeAdmin() {
  if (document.body.dataset.adminPage === "login") {
    const page = await import("./pages/admin-login.js");
    await page.initialize();
    return;
  }

  await initializeProtectedPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAdmin, { once: true });
} else {
  initializeAdmin();
}
