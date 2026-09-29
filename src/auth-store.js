const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 64;
const HASH_DIGEST = "sha512";

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST)
    .toString("hex");

  return `pbkdf2$${HASH_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, iterationsRaw, salt, expectedHash] = String(storedHash).split("$");

  if (algorithm !== "pbkdf2" || !iterationsRaw || !salt || !expectedHash) {
    return false;
  }

  const calculatedHash = crypto
    .pbkdf2Sync(password, salt, Number(iterationsRaw), HASH_KEY_LENGTH, HASH_DIGEST)
    .toString("hex");

  return crypto.timingSafeEqual(Buffer.from(calculatedHash, "hex"), Buffer.from(expectedHash, "hex"));
}

class AuthStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.users = [];
    this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      this.users = [];
      return;
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    this.users = raw.trim() ? JSON.parse(raw).users || [] : [];
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify({ users: this.users }, null, 2)}\n`);
  }

  listSafeUsers() {
    return this.users.map(({ id, name, email, role }) => ({ id, name, email, role }));
  }

  findByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    return this.users.find((user) => user.email === normalizedEmail) || null;
  }

  findById(id) {
    return this.users.find((user) => user.id === id) || null;
  }

  createUser({ name, email, password, role = "customer" }) {
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password) {
      const error = new Error("name, email y password son requeridos.");
      error.status = 400;
      throw error;
    }

    if (this.findByEmail(normalizedEmail)) {
      const error = new Error("Ya existe una cuenta con ese correo.");
      error.status = 409;
      throw error;
    }

    const user = {
      id: crypto.randomUUID(),
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: createPasswordHash(password),
      role: role === "admin" ? "admin" : "customer",
      createdAt: new Date().toISOString()
    };

    this.users.push(user);
    this.save();

    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

module.exports = {
  AuthStore,
  createPasswordHash,
  normalizeEmail,
  verifyPassword
};
