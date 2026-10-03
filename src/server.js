const http = require("http");
const fs = require("fs");
const path = require("path");
const { AuthStore, normalizeEmail, verifyPassword } = require("./auth-store");
const { SessionManager, SESSION_TTL_MS } = require("./session-manager");

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "..", "data", "users.json");
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const GENERIC_AUTH_ERROR = "Correo o contrasena incorrectos.";

function createApp({ store = new AuthStore(DATA_FILE), sessions = new SessionManager() } = {}) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/") {
        return serveStatic(res, "index.html", "text/html; charset=utf-8");
      }

      if (req.method === "GET" && req.url === "/styles.css") {
        return serveStatic(res, "styles.css", "text/css; charset=utf-8");
      }

      if (req.method === "GET" && req.url === "/app.js") {
        return serveStatic(res, "app.js", "application/javascript; charset=utf-8");
      }

      if (req.method === "POST" && req.url === "/api/register") {
        const payload = await readJson(req);
        const user = store.createUser({
          name: payload.name,
          email: payload.email,
          password: payload.password,
          role: "customer"
        });
        return sendJson(res, 201, { user });
      }

      if (req.method === "POST" && req.url === "/api/login") {
        const payload = await readJson(req);
        const email = normalizeEmail(payload.email);
        const user = store.findByEmail(email);

        if (sessions.isLocked(email)) {
          return sendJson(res, 429, { error: "Cuenta bloqueada temporalmente. Intenta de nuevo mas tarde." });
        }

        if (!user || !verifyPassword(payload.password || "", user.passwordHash)) {
          sessions.registerFailure(email);
          return sendJson(res, 401, { error: GENERIC_AUTH_ERROR });
        }

        sessions.resetFailures(email);
        const { sessionId, expiresAt } = sessions.createSession(user.id);
        setSessionCookie(res, sessionId, expiresAt);

        return sendJson(res, 200, {
          user: safeUser(user),
          expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000)
        });
      }

      if (req.method === "POST" && req.url === "/api/logout") {
        const sessionId = getCookie(req, "session_id");
        sessions.invalidate(sessionId);
        clearSessionCookie(res);
        return sendJson(res, 200, { message: "Sesion cerrada." });
      }

      if (req.method === "GET" && req.url === "/api/me") {
        const auth = requireAuth(req, store, sessions);
        if (!auth.ok) {
          return sendJson(res, auth.status, { error: auth.error });
        }

        return sendJson(res, 200, { user: safeUser(auth.user) });
      }

      if (req.method === "GET" && req.url === "/api/admin/users") {
        const auth = requireAuth(req, store, sessions, "admin");
        if (!auth.ok) {
          return sendJson(res, auth.status, { error: auth.error });
        }

        return sendJson(res, 200, { users: store.listSafeUsers() });
      }

      return sendJson(res, 404, { error: "Ruta no encontrada." });
    } catch (error) {
      const status = error.status || 500;
      return sendJson(res, status, { error: status === 500 ? "Error interno del servidor." : error.message });
    }
  });
}

function requireAuth(req, store, sessions, requiredRole = null) {
  const session = sessions.getSession(getCookie(req, "session_id"));

  if (!session) {
    return { ok: false, status: 401, error: "Sesion requerida o expirada." };
  }

  const user = store.findById(session.userId);

  if (!user) {
    return { ok: false, status: 401, error: "Sesion requerida o expirada." };
  }

  if (requiredRole && user.role !== requiredRole) {
    return { ok: false, status: 403, error: "No tienes permisos para acceder a este recurso." };
  }

  return { ok: true, user };
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function serveStatic(res, fileName, contentType) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(fs.readFileSync(filePath));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error("Solicitud demasiado grande."), { status: 413 }));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error("JSON invalido."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const cookies = header.split(";").map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return target ? decodeURIComponent(target.slice(name.length + 1)) : "";
}

function setSessionCookie(res, sessionId, expiresAt) {
  res.setHeader("Set-Cookie", [
    `session_id=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000
    )}; Expires=${new Date(expiresAt).toUTCString()}`
  ]);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", ["session_id=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"]);
}

if (require.main === module) {
  const server = createApp();
  server.listen(PORT, () => {
    console.log(`Servidor disponible en http://localhost:${PORT}`);
  });
}

module.exports = {
  GENERIC_AUTH_ERROR,
  createApp
};
