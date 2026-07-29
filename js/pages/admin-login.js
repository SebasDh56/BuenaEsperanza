import {
  AuthorizationError,
  getAuthorizedContext,
  safeAdminReturnPath,
  signInWithPassword,
} from "../modules/auth.js";
import {
  clearNotification,
  setButtonBusy,
  showNotification,
} from "../modules/notifications.js";

export async function initialize() {
  const form = document.querySelector("[data-login-form]");
  const notification = document.querySelector("[data-login-notification]");
  const submitButton = form?.querySelector('button[type="submit"]');
  const returnTo = safeAdminReturnPath(
    new URLSearchParams(window.location.search).get("returnTo"),
  );

  if (!form || !submitButton) {
    return;
  }

  try {
    const currentContext = await getAuthorizedContext();

    if (currentContext) {
      window.location.replace(returnTo);
      return;
    }
  } catch (error) {
    if (!(error instanceof AuthorizationError)) {
      showNotification(
        notification,
        "No se pudo comprobar la sesión actual. Puedes intentar iniciar sesión.",
        "warning",
      );
    }
  }

  form.hidden = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotification(notification);

    if (!form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    setButtonBusy(submitButton, true, "Iniciando sesión…");

    try {
      await signInWithPassword({
        email: formData.get("email"),
        password: formData.get("password"),
      });
      window.location.replace(returnTo);
    } catch (error) {
      showNotification(
        notification,
        error instanceof AuthorizationError
          ? error.message
          : "No se pudo conectar con el servicio de autenticación.",
        "error",
      );
      setButtonBusy(submitButton, false);
    }
  });
}
