const assert = require("node:assert/strict");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { AuthStore } = require("../src/auth-store");
const { createApp, GENERIC_AUTH_ERROR } = require("../src/server");
const { SessionManager, SESSION_TTL_MS } = require("../src/session-manager");

test("login crea sesion y permite ver usuario autenticado", async (t) => {
  const client = await createTestClient(t);
  await client.store.createUser({ name: "Reing", email: "reing01@example.com", password: "secreto123" });

  const login = await client.request("POST", "/api/login", {
    email: "reing01@example.com",
    password: "secreto123"
  });

  assert.equal(login.status, 200);
  assert.ok(login.cookie.includes("session_id="));

  const me = await client.request("GET", "/api/me", null, login.cookie);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, "reing01@example.com");
});

test("correo desconocido y password incorrecto retornan mensaje generico sin sesion", async (t) => {
  const client = await createTestClient(t);
  await client.store.createUser({ name: "Reing", email: "reing01@example.com", password: "secreto123" });

  const unknown = await client.request("POST", "/api/login", {
    email: "nadie@example.com",
    password: "secreto123"
  });
  const wrongPassword = await client.request("POST", "/api/login", {
    email: "reing01@example.com",
    password: "incorrecta"
  });

  assert.equal(unknown.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknown.body.error, GENERIC_AUTH_ERROR);
  assert.equal(wrongPassword.body.error, GENERIC_AUTH_ERROR);
  assert.equal(unknown.cookie, "");
  assert.equal(wrongPassword.cookie, "");
});

test("sesion expira tras treinta minutos de inactividad", async (t) => {
  let now = Date.now();
  const client = await createTestClient(t, { now: () => now });
  await client.store.createUser({ name: "Reing", email: "reing01@example.com", password: "secreto123" });

  const login = await client.request("POST", "/api/login", {
    email: "reing01@example.com",
    password: "secreto123"
  });

  now += SESSION_TTL_MS + 1;
  const me = await client.request("GET", "/api/me", null, login.cookie);

  assert.equal(me.status, 401);
});

test("logout invalida la sesion activa", async (t) => {
  const client = await createTestClient(t);
  await client.store.createUser({ name: "Reing", email: "reing01@example.com", password: "secreto123" });
  const login = await client.request("POST", "/api/login", {
    email: "reing01@example.com",
    password: "secreto123"
  });

  const logout = await client.request("POST", "/api/logout", {}, login.cookie);
  const me = await client.request("GET", "/api/me", null, login.cookie);

  assert.equal(logout.status, 200);
  assert.equal(me.status, 401);
});

test("cinco intentos fallidos bloquean nuevos intentos por quince minutos", async (t) => {
  const client = await createTestClient(t);
  await client.store.createUser({ name: "Reing", email: "reing01@example.com", password: "secreto123" });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await client.request("POST", "/api/login", {
      email: "reing01@example.com",
      password: "mala"
    });
    assert.equal(response.status, 401);
  }

  const locked = await client.request("POST", "/api/login", {
    email: "reing01@example.com",
    password: "secreto123"
  });

  assert.equal(locked.status, 429);
});

test("modificar el rol desde el cliente no concede acceso administrativo", async (t) => {
  const client = await createTestClient(t);
  await client.request("POST", "/api/register", {
    name: "Cliente",
    email: "cliente@example.com",
    password: "secreto123",
    role: "admin"
  });
  await client.store.createUser({
    name: "Admin",
    email: "admin@example.com",
    password: "secreto123",
    role: "admin"
  });

  const customerLogin = await client.request("POST", "/api/login", {
    email: "cliente@example.com",
    password: "secreto123",
    role: "admin"
  });
  const denied = await client.request("GET", "/api/admin/users", null, customerLogin.cookie);

  const adminLogin = await client.request("POST", "/api/login", {
    email: "admin@example.com",
    password: "secreto123"
  });
  const allowed = await client.request("GET", "/api/admin/users", null, adminLogin.cookie);

  assert.equal(denied.status, 403);
  assert.equal(allowed.status, 200);
});

async function createTestClient(t, { now = () => Date.now() } = {}) {
  const store = new AuthStore(path.join(os.tmpdir(), `laboratorio-git-${Date.now()}-${Math.random()}.json`));
  const server = createApp({ store, sessions: new SessionManager({ now }) });

  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());

  const { port } = server.address();

  return {
    store,
    request(method, route, payload, cookie = "") {
      return request({ method, port, route, payload, cookie });
    }
  };
}

function request({ method, port, route, payload, cookie }) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : "";
    const req = http.request(
      {
        method,
        port,
        path: route,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Cookie: cookie
        }
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: raw ? JSON.parse(raw) : {},
            cookie: (res.headers["set-cookie"] || []).join("; ")
          });
        });
      }
    );

    req.on("error", reject);
    req.end(body);
  });
}
