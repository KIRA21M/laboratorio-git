const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const logoutButton = document.querySelector("#logout-button");
const statusTitle = document.querySelector("#status-title");
const statusText = document.querySelector("#status-text");
const userBox = document.querySelector("#user-box");
const message = document.querySelector("#message");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await request("/api/login", formPayload(loginForm));
  showMessage(response);
  await refreshSession();
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await request("/api/register", formPayload(registerForm));
  showMessage(response, "Cuenta registrada. Ya puedes iniciar sesion.");
  if (response.ok) {
    registerForm.reset();
  }
});

logoutButton.addEventListener("click", async () => {
  const response = await request("/api/logout", {});
  showMessage(response, "Sesion cerrada.");
  await refreshSession();
});

async function refreshSession() {
  const response = await fetch("/api/me", { credentials: "same-origin" });
  const payload = await response.json();

  if (!response.ok) {
    statusTitle.textContent = "Sin sesion activa";
    statusText.textContent = "Inicia sesion para ver los datos de tu cuenta.";
    userBox.hidden = true;
    logoutButton.hidden = true;
    return;
  }

  statusTitle.textContent = `Hola, ${payload.user.name}`;
  statusText.textContent = "Tu sesion esta activa y protegida por el servidor.";
  userBox.hidden = false;
  logoutButton.hidden = false;
  userBox.innerHTML = `
    <strong>${payload.user.email}</strong>
    <span>Rol: ${payload.user.role}</span>
  `;
}

async function request(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  return { ok: response.ok, status: response.status, body };
}

function formPayload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showMessage(response, successMessage = "Operacion realizada.") {
  message.textContent = response.ok ? successMessage : response.body.error;
}

refreshSession();
