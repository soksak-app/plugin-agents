// The button 로그인 취소 of the settings view (A58, docs/spec/definitions.md#settings-view). The rows of the accounts are drawn again
// while a login runs, so the view registers the element once with a function that returns the current button, and each drawing marks
// its new button with the name.
export const LOGIN_CANCEL_ELEMENT = "agents.settings.login-cancel";

// Registers the element agents.settings.login-cancel once: its elements are the marked buttons in list at the time of each request.
export function registerLoginCancel(exposure, list) {
  return exposure.element(LOGIN_CANCEL_ELEMENT, () => [...list.querySelectorAll(`[data-expose="${LOGIN_CANCEL_ELEMENT}"]`)]);
}

// Makes the button 로그인 취소 of a drawing of the rows.
export function loginCancelButton(doc) {
  const cancel = Object.assign(doc.createElement("button"), { type: "button", textContent: "로그인 취소" });
  cancel.dataset.expose = LOGIN_CANCEL_ELEMENT;
  return cancel;
}
