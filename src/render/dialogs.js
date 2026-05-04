export function renderConfirmDialog({ dialog = {}, escapeHtml } = {}) {
  const safeEscape = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value ?? "");
  if (!dialog?.open) return "";
  const confirmToneClass = dialog.confirmTone === "warning" ? "button button-warning" : "button button-primary";
  return `
    <div id="confirm-dialog-backdrop" class="confirm-overlay" role="presentation">
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <header class="confirm-dialog-header">
          <h3 id="confirm-dialog-title">${safeEscape(dialog.title || "Please Confirm")}</h3>
        </header>
        <div class="confirm-dialog-body">
          ${(dialog.lines ?? []).map((line) => `<p>${safeEscape(line)}</p>`).join("")}
        </div>
        <footer class="confirm-dialog-actions">
          <button id="confirm-dialog-cancel" class="button button-quiet" type="button">${safeEscape(
            dialog.cancelLabel || "Cancel",
          )}</button>
          <button id="confirm-dialog-confirm" class="${confirmToneClass}" type="button">${safeEscape(
            dialog.confirmLabel || "Confirm",
          )}</button>
        </footer>
      </section>
    </div>
  `;
}

export function renderInactivityWarningDialog({ warning = {}, formatDuration, escapeHtml } = {}) {
  const safeEscape = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value ?? "");
  if (!warning?.open) return "";
  const remaining =
    typeof formatDuration === "function" ? formatDuration(warning.remainingSeconds) : String(warning.remainingSeconds ?? 0);
  return `
    <div id="inactivity-dialog-backdrop" class="confirm-overlay" role="presentation">
      <section class="confirm-dialog inactivity-dialog" role="dialog" aria-modal="true" aria-labelledby="inactivity-dialog-title">
        <header class="confirm-dialog-header">
          <h3 id="inactivity-dialog-title">Inactivity Warning</h3>
        </header>
        <div class="confirm-dialog-body">
          <p>There has been no activity in the last hour. You will be automatically logged out in 5 minutes.</p>
          <p class="inactivity-countdown">Time remaining: ${safeEscape(remaining)}</p>
        </div>
        <footer class="confirm-dialog-actions">
          <button id="disable-auto-logout-button" class="button button-quiet" type="button">Turn Off Auto Logout</button>
          <button id="logout-now-button" class="button button-warning" type="button">Logout Now</button>
          <button id="stay-signed-in-button" class="button button-primary" type="button">Stay Signed In</button>
        </footer>
      </section>
    </div>
  `;
}
