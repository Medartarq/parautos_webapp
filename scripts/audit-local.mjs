// Isolated verification. Requires explicitly configured local test credentials.
// Never imports the application's configured DB_NAME or modifies that database.
import dotenv from "dotenv";
import mariadb from "mariadb";
import express from "express";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

dotenv.config({ quiet: true });
const host = process.env.MIGRATION_TEST_DB_HOST;
const port = Number(process.env.MIGRATION_TEST_DB_PORT);
const user = process.env.MIGRATION_TEST_DB_USER;
const password = process.env.MIGRATION_TEST_DB_PASSWORD;
if (!["127.0.0.1", "localhost", "::1"].includes(host) || !port || !user || !password)
  throw new Error("Configure MIGRATION_TEST_DB_* for an explicitly authorized local test account.");
const database = `parautos_audit_${randomUUID().replaceAll("-", "")}`;
const demoDatabase = `${database}_demo`;
const evidence = resolve("docs/auditoria/2026-10-25/evidencia");
const uploads = resolve(evidence, "tmp", database);
assert.ok(uploads.startsWith(evidence + sep));
const testPassword = randomBytes(24).toString("base64url");
const bootstrapToken = randomBytes(32).toString("hex");
Object.assign(process.env, {
  NODE_ENV: "test", DB_HOST: host, DB_PORT: String(port), DB_USER: user, DB_PASSWORD: password, DB_NAME: database,
  DEMO_MODE_ENABLED: "true", DEMO_DB_HOST: host, DEMO_DB_PORT: String(port), DEMO_DB_USER: user, DEMO_DB_PASSWORD: password, DEMO_DB_NAME: demoDatabase,
  STORAGE_PROVIDER: "local", LOCAL_UPLOAD_BASE: "project", LOCAL_UPLOAD_DIR: `docs/auditoria/2026-10-25/evidencia/tmp/${database}/main`,
  DEMO_LOCAL_UPLOAD_BASE: "project", DEMO_LOCAL_UPLOAD_DIR: `docs/auditoria/2026-10-25/evidencia/tmp/${database}/demo`,
  APP_ORIGIN: "http://127.0.0.1:4180", BOOTSTRAP_ADMIN_EMAIL: "audit@invalid.local", BOOTSTRAP_ADMIN_TOKEN: bootstrapToken,
});
const administrator = await mariadb.createConnection({ host, port, user, password });
let server;
let pools;
const created = [];
const results = [];
let cleaned = false;
let stopServing;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (server) await new Promise((done) => server.close(done));
  await pools?.closePool();
  try { for (const name of created.reverse()) await administrator.query(`DROP DATABASE \`${name}\``); }
  finally { await administrator.end(); await rm(uploads, { recursive: true, force: true }); }
}
try {
  const version = (await administrator.query("SELECT VERSION() AS version"))[0].version;
  assert.match(version, /MariaDB/);
  for (const name of [database, demoDatabase]) {
    assert.match(name, /^parautos_audit_[a-f0-9]{32}(_demo)?$/);
    await administrator.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created.push(name);
  }
  pools = await import("../server/src/db/pool.ts");
  const { applyMigrations } = await import("../server/src/db/migrate.ts");
  await applyMigrations(pools.getProductionPool());
  await applyMigrations(pools.getDemoPool());
  const { createApp } = await import("../server/src/app.ts");
  const { login, cookieOptions } = await import("../server/src/modules/auth/service.ts");
  const app = express();
  app.disable("x-powered-by");
  app.post("/audit-stop", (_req, res) => { res.status(204).end(); stopServing?.(); });
  let forcedFailure = "";
  // This helper exists only in this loopback test process with synthetic users.
  app.get("/audit-login", async (req, res) => {
    forcedFailure = ["orders", "reports"].includes(req.query.failure) ? req.query.failure : "";
    const identifier = req.query.role === "advisor" ? "audit.advisor" : "audit.super";
    const session = await login({ identifier, password: testPassword });
    res.cookie("parautos_session", session.token, cookieOptions()).redirect("/");
  });
  app.use("/api/v1", (req, res, next) => {
    if (forcedFailure === "orders" && req.path === "/orders" || forcedFailure === "reports" && req.path === "/reports/operational")
      return res.status(503).json({ error: { code: "AUDIT_TEST_FAILURE", message: "Fallo sintético de auditoría. Intente nuevamente." } });
    next();
  });
  app.use(createApp());
  server = await new Promise((done) => { const listening = app.listen(4180, "127.0.0.1", () => done(listening)); });
  const origin = "http://127.0.0.1:4180/api/v1";
  let cookie = "";
  async function call(path, method = "GET", body, expected = 200, sessionCookie = cookie) {
    const response = await fetch(origin + path, { method, headers: { "content-type": "application/json", ...(sessionCookie ? { cookie: sessionCookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = response.status === 204 ? undefined : await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(json)}`);
    results.push({ method, path: path.split("?")[0], status: response.status });
    return { json, response };
  }
  await call("/health");
  assert.equal((await call("/setup/status")).json.configured, false);
  await call("/setup/initial", "POST", { token: bootstrapToken, email: "audit@invalid.local", username: "audit.super", names: "Auditoría Sintética", password: testPassword }, 201);
  cookie = (await call("/auth/login", "POST", { identifier: "audit.super", password: testPassword })).response.headers.get("set-cookie").split(";")[0];
  await call("/auth/me");
  const advisorId = (await call("/users", "POST", { names: "Asesor Sintético", username: "audit.advisor", email: "advisor@invalid.local", role: "ASESOR", password: testPassword }, 201)).json.user.id;
  const advisorCookie = (await call("/auth/login", "POST", { identifier: "audit.advisor", password: testPassword })).response.headers.get("set-cookie").split(";")[0];
  for (const path of ["/users", "/audit/events", "/reports/operational"]) await call(path, "GET", undefined, 403, advisorCookie);
  await call(`/users/${advisorId}/active`, "PATCH", { active: false }, 204);
  await call("/auth/me", "GET", undefined, 401, advisorCookie);
  await call(`/users/${advisorId}/active`, "PATCH", { active: true }, 204);
  await call("/users", "POST", { names: "Administrador Sintético", username: "audit.admin", email: "admin@invalid.local", role: "ADMINISTRADOR", password: testPassword }, 201);
  const adminCookie = (await call("/auth/login", "POST", { identifier: "audit.admin", password: testPassword })).response.headers.get("set-cookie").split(";")[0];
  await call("/users", "GET", undefined, 403, adminCookie);
  await call("/reports/operational", "GET", undefined, 200, adminCookie);
  await call("/audit/events", "GET", undefined, 200, adminCookie);
  const disposable = (await call("/users", "POST", { names: "Usuario Descartable", username: "audit.disposable", email: "disposable@invalid.local", role: "ASESOR", password: testPassword }, 201)).json.user;
  await call(`/users/${disposable.id}`, "DELETE", undefined, 204);
  await call("/orders", "GET", undefined, 401, "");
  const catalog = (await call("/orders/reception-catalog")).json;
  const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5wQAAAABJRU5ErkJggg==";
  const orderInput = {
    client: { documentType: "DNI", documentNumber: "70000001", fullName: "Cliente Sintético", phone: "999000001" },
    vehicle: { plate: "AUD-101", brand: "TOYOTA", model: "COROLLA", color: "Blanco", colorType: "CATALOGO", bodyTypeId: catalog.bodyTypes[0].id },
    modality: "PARTICULAR", checklistReviewed: true, acceptedTerms: true, signature,
    checklist: catalog.checklist.map((item) => ({ itemId: item.id, answer: "SI" })),
  };
  const order = (await call("/orders", "POST", orderInput, 201)).json.order;
  const id = order.id;
  const initialDetail = (await call(`/orders/${id}`)).json.order;
  assert.equal(initialDetail.receptionSnapshot.source, "RECEPTION");
  const originalSnapshot = JSON.stringify(initialDetail.receptionSnapshot.payload);
  const nextOrder = (await call("/orders", "POST", { ...orderInput, client: { ...orderInput.client, fullName: "Cliente Actualizado", phone: "999000002", email: "updated@invalid.local" }, vehicle: { ...orderInput.vehicle, brand: "KIA", model: "RIO", color: "Rojo" } }, 201)).json.order;
  const priorDetail = (await call(`/orders/${id}`)).json.order;
  assert.equal(priorDetail.client, "Cliente Sintético");
  assert.equal(priorDetail.brand, "TOYOTA");
  assert.equal(priorDetail.email, null);
  assert.equal(JSON.stringify(priorDetail.receptionSnapshot.payload), originalSnapshot);
  const orderList = (await call("/orders")).json.orders;
  assert.equal(orderList.find((item) => item.id === id).brand, "TOYOTA");
  assert.equal(orderList.find((item) => item.id === nextOrder.id).brand, "KIA");
  await call(`/orders/${id}/operational-data`, "PATCH", { phoneOverride: "999000003", modality: "MAPFRE", claimNumber: "AUD-CLAIM", claimPendingReminder: false, reason: "Corrección sintética del caso" }, 204);
  const corrected = (await call(`/orders/${id}`)).json.order;
  assert.equal(corrected.operationalPhone, "999000003");
  assert.equal(corrected.modality, "MAPFRE");
  assert.equal(corrected.receptionSnapshot.payload.modality, "PARTICULAR");
  assert.equal(JSON.stringify(corrected.receptionSnapshot.payload), originalSnapshot);
  results.push({ method: "ASSERT", path: "reception snapshot survives master upsert and operational correction", status: 200 });
  await call("/lookups/local/client/70000001");
  await call("/lookups/local/vehicle/AUD101");
  const upload = new FormData();
  upload.set("category", "EVALUACION_MANUSCRITA");
  upload.set("file", new Blob([Buffer.from(signature.split(",")[1], "base64")], { type: "image/png" }), "evaluacion.png");
  const uploaded = await fetch(`${origin}/attachments/orders/${id}`, { method: "POST", headers: { cookie }, body: upload });
  assert.equal(uploaded.status, 201);
  const attachmentId = (await uploaded.json()).attachment.id;
  const content = await fetch(`${origin}/attachments/${attachmentId}/content`, { headers: { cookie } });
  assert.equal(content.status, 200);
  assert.equal(Buffer.from(await content.arrayBuffer()).equals(Buffer.from(signature.split(",")[1], "base64")), true);
  results.push({ method: "POST/GET", path: "/attachments/orders/:id (PNG byte equality)", status: 200 });
  await call(`/attachments/${attachmentId}/content`, "GET", undefined, 401, "");
  const quote = (await call(`/orders/${id}/quotes`, "POST", { currency: "PEN", noParts: false, lines: [{ type: "MANO_OBRA", category: "PINTURA", description: "Pintura de prueba", quantity: 1, unitPrice: 100 }, { type: "REPUESTO", description: "Repuesto de prueba", quantity: 1, unitPrice: 50 }] }, 201)).json.quote;
  await call(`/orders/${id}/quotes/${quote.id}/send`, "POST");
  await call(`/orders/${id}/quotes/${quote.id}/approve`, "POST");
  const part = (await call(`/orders/${id}/parts`)).json.parts[0];
  await call(`/orders/${id}/start-repair`, "POST", undefined, 409);
  await call(`/orders/parts/${part.id}`, "PATCH", { receivedQuantity: 1, managementStatus: "PEDIDO", quality: "ORIGINAL" });
  await call(`/orders/${id}/start-repair`, "POST", undefined, 204);
  await call(`/orders/${id}/final-control/complete`, "POST", undefined, 409);
  await call(`/orders/${id}/final-control/labor`, "PUT", { verified: true }, 204);
  await call(`/orders/${id}/final-control/complete`, "POST", undefined, 204);
  await call(`/orders/${id}/final-control/complete`, "POST", undefined, 409);
  await call(`/orders/${id}/final-control/publish`, "POST", { channel: "Prueba local" }, 204);
  await call(`/orders/${id}/final-control/deliver`, "POST", { conformityAcknowledged: true }, 204);
  await call(`/orders/${id}/start-repair`, "POST", undefined, 409);
  await call(`/orders/${id}/final-control/complete`, "POST", undefined, 409);
  const tracking = (await call(`/tracking?plate=AUD101&code=${order.publicCode}`, "GET", undefined, 200, "")).json.tracking;
  assert.equal(tracking.publicStatus, "ENTREGADA");
  await call(`/orders/${id}`);
  await call(`/orders/${id}/operational-data`, "PATCH", { claimPendingReminder: false, reason: "Prueba terminal" }, 409);
  await call("/reports/operational");
  await call("/audit/events");
  await call("/orders/reception-draft", "PUT", { currentStep: 0, payload: { d: { client: "Borrador sintético" } } });
  await call("/orders/reception-draft", "PUT", { currentStep: 0, payload: {}, revision: 99 }, 409);
  await call("/demo/enter", "POST", undefined, 204);
  assert.equal((await call("/orders", "GET", undefined, 200, cookie + "; parautos_demo_mode=1")).json.orders.length, 0);
  await call("/orders/navigation-summary");
  await call("/orders/pending-notifications");
  // Seed extra synthetic orders for the browser, exclusively in the new database.
  const role = (await pools.getProductionPool().query("SELECT id FROM roles WHERE code='SUPERADMINISTRADOR'"))[0];
  await pools.getProductionPool().query("INSERT INTO users (role_id, names, username, email, password_hash) VALUES (?, 'Actor sintético', 'demo.system', 'system@invalid.local', 'TEST_ONLY')", [role.id]);
  const { seedDemo } = await import("../server/src/db/seed-demo.ts");
  await seedDemo();
  const seeded = (await call("/orders")).json.orders.find((item) => item.plate === "DEM101");
  const draftBody = { currency: "PEN", noParts: true, lines: [{ type: "MANO_OBRA", category: "PINTURA", description: "Borrador de prueba", quantity: 1, unitPrice: 20 }] };
  await call(`/orders/${seeded.id}/quote-draft`, "PUT", draftBody);
  await call(`/orders/${seeded.id}/quotes/from-draft`, "POST", { adjustmentReason: "Prueba de versionado" }, 201);
  const versions = (await call(`/orders/${seeded.id}/quotes`)).json.quotes;
  assert.equal(versions.length, 2);
  await call(`/orders/${seeded.id}/quotes/${versions[0].id}`, "PUT", draftBody);
  await call(`/orders/${seeded.id}/quotes/${versions[0].id}`, "DELETE", undefined, 204);
  await mkdir(evidence, { recursive: true });
  await writeFile(resolve(evidence, "integracion-local.json"), JSON.stringify({ databaseVersion: version, isolated: true, migrationsPerDatabase: 23, checks: results }, null, 2));
  console.info(`AUDIT_OK: ${results.length} HTTP checks; isolated MariaDB and local storage.`);
  if (process.argv.includes("--serve")) {
    console.info("Visual review: http://127.0.0.1:4180/audit-login (synthetic data only). Ctrl+C cleans up both databases and uploads.");
    await new Promise((done) => { stopServing = done; process.once("SIGINT", done); process.once("SIGTERM", done); });
  }
} finally { await cleanup(); }
