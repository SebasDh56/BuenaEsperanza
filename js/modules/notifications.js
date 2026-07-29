export function showNotification(container, message, type = "info") {
  if (!container) {
    return;
  }

  container.textContent = message;
  container.dataset.notificationType = type;
  container.hidden = false;
}

export function clearNotification(container) {
  if (!container) {
    return;
  }

  container.textContent = "";
  container.hidden = true;
  delete container.dataset.notificationType;
}

export function setButtonBusy(button, isBusy, busyLabel = "Procesando…") {
  if (!button) {
    return;
  }

  if (isBusy) {
    button.dataset.idleLabel = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.idleLabel ?? button.textContent;
  button.disabled = false;
  delete button.dataset.idleLabel;
}
