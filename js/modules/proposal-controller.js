import { runtimeConfig } from "../config/runtime-config.js";
import { submitProposal } from "./proposal-service.js";
import { validateProposalForm } from "./proposal-validation.js";

let turnstileLoader;

function loadTurnstile() {
  if (globalThis.turnstile) {
    return Promise.resolve(globalThis.turnstile);
  }

  if (turnstileLoader) {
    return turnstileLoader;
  }

  turnstileLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(globalThis.turnstile);
    script.onerror = () =>
      reject(new Error("No se pudo cargar la verificación de seguridad."));
    document.head.append(script);
  });

  return turnstileLoader;
}

function showStatus(element, message, type) {
  element.textContent = message;
  element.dataset.type = type;
  element.hidden = false;
  element.focus({ preventScroll: true });
}

export function initializeProposalForm() {
  const form = document.querySelector("[data-proposal-form]");

  if (!form) {
    return;
  }

  const status = form.querySelector("[data-proposal-status]");
  const submitButton = form.querySelector("[data-proposal-submit]");
  const turnstileContainer = form.querySelector("[data-turnstile-container]");
  let widgetId = null;

  if (runtimeConfig.turnstileSiteKey) {
    loadTurnstile()
      .then((turnstile) => {
        widgetId = turnstile.render(turnstileContainer, {
          sitekey: runtimeConfig.turnstileSiteKey,
          theme: "light",
          language: "es",
        });
      })
      .catch((error) => showStatus(status, error.message, "error"));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const validationError = validateProposalForm(formData);

    if (validationError) {
      showStatus(status, validationError, "error");
      return;
    }

    if (!runtimeConfig.turnstileSiteKey) {
      showStatus(
        status,
        "La verificación de seguridad no está disponible. Comunícate mediante el correo oficial.",
        "error",
      );
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Enviando…";
    showStatus(status, "Enviando la propuesta de forma segura…", "info");

    try {
      const result = await submitProposal(formData);
      form.reset();

      if (widgetId !== null) {
        globalThis.turnstile?.reset(widgetId);
      }

      showStatus(
        status,
        result.message || "Tu propuesta fue recibida para revisión.",
        "success",
      );
    } catch (error) {
      if (widgetId !== null) {
        globalThis.turnstile?.reset(widgetId);
      }

      showStatus(
        status,
        error?.message ||
          "No se pudo enviar la propuesta. Inténtalo nuevamente.",
        "error",
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar propuesta";
    }
  });
}
