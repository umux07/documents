import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import mariadb from "mariadb";
import { after, test } from "node:test";

const apiUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const frontendOrigin =
  process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:3000";
const testPassword = "Ysom-integration-pass-2026!";
const databaseUrl = new URL(process.env.DATABASE_URL);
const connection = await mariadb.createConnection({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, "")),
});
let testEmail;

function requestHeaders(cookie) {
  return {
    Origin: frontendOrigin,
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

function cookieFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "successful sign-in should set a session cookie");
  assert.match(setCookie, /httponly/i);
  assert.match(setCookie, /samesite=lax/i);
  return setCookie.split(";", 1)[0];
}

test("registration, login, protected dashboard, and logout", async () => {
  testEmail = `integration-${randomUUID()}@example.test`;

  try {
    const anonymousDashboard = await fetch(`${apiUrl}/dashboard`);
    assert.equal(anonymousDashboard.status, 401);

    const anonymousProfile = await fetch(`${apiUrl}/auth/me`);
    assert.equal(anonymousProfile.status, 401);

    const rejectedOrigin = await fetch(`${apiUrl}/auth/register`, {
      method: "POST",
      headers: {
        ...requestHeaders(),
        Origin: "https://not-ysom.example",
      },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.equal(rejectedOrigin.status, 403);

    const validationResponse = await fetch(`${apiUrl}/auth/register`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email: testEmail, password: "short" }),
    });
    assert.equal(validationResponse.status, 400);

    const registrationResponse = await fetch(`${apiUrl}/auth/register`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.equal(registrationResponse.status, 201);
    const registrationCookie = cookieFrom(registrationResponse);
    const registration = await registrationResponse.json();
    assert.equal(registration.user.email, testEmail);
    assert.equal("passwordHash" in registration.user, false);

    const registeredProfile = await fetch(`${apiUrl}/auth/me`, {
      headers: requestHeaders(registrationCookie),
    });
    assert.equal(registeredProfile.status, 200);
    assert.equal((await registeredProfile.json()).user.email, testEmail);

    const storedUsers = await connection.query(
      "SELECT `passwordHash` FROM `User` WHERE `email` = ?",
      [testEmail],
    );
    assert.equal(storedUsers.length, 1);
    assert.notEqual(storedUsers[0].passwordHash, testPassword);
    assert.match(storedUsers[0].passwordHash, /^scrypt\$/);

    const duplicateResponse = await fetch(`${apiUrl}/auth/register`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.equal(duplicateResponse.status, 409);
    assert.doesNotMatch(await duplicateResponse.text(), new RegExp(testEmail));

    const wrongPasswordResponse = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email: testEmail, password: "incorrect-password" }),
    });
    assert.equal(wrongPasswordResponse.status, 401);
    const wrongPasswordBody = await wrongPasswordResponse.json();

    const unknownEmailResponse = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({
        email: `unknown-${randomUUID()}@example.test`,
        password: "incorrect-password",
      }),
    });
    assert.equal(unknownEmailResponse.status, 401);
    assert.deepEqual(await unknownEmailResponse.json(), wrongPasswordBody);

    const loginResponse = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.equal(loginResponse.status, 200);
    const loginCookie = cookieFrom(loginResponse);

    const loggedInProfile = await fetch(`${apiUrl}/auth/me`, {
      headers: requestHeaders(loginCookie),
    });
    assert.equal(loggedInProfile.status, 200);

    const authenticatedDashboard = await fetch(`${apiUrl}/dashboard`, {
      headers: requestHeaders(loginCookie),
    });
    assert.equal(authenticatedDashboard.status, 200);
    const dashboard = await authenticatedDashboard.json();
    assert.equal(dashboard.user.email, testEmail);
    assert.ok(dashboard.services.length > 0);
    assert.ok(dashboard.services.every(({ status }) => status === "not_connected"));

    const logoutResponse = await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      headers: requestHeaders(loginCookie),
    });
    assert.equal(logoutResponse.status, 204);

    const revokedDashboard = await fetch(`${apiUrl}/dashboard`, {
      headers: requestHeaders(loginCookie),
    });
    assert.equal(revokedDashboard.status, 401);

    const sessionHash = (cookie) =>
      createHash("sha256")
        .update(cookie.split(";", 1)[0].split("=", 2)[1])
        .digest("hex");
    const registrationSessions = await connection.query(
      "SELECT `id` FROM `Session` WHERE `tokenHash` = ?",
      [sessionHash(registrationCookie)],
    );
    assert.equal(registrationSessions.length, 1);
    const revokedLoginSessions = await connection.query(
      "SELECT `id` FROM `Session` WHERE `tokenHash` = ?",
      [sessionHash(loginCookie)],
    );
    assert.equal(revokedLoginSessions.length, 0);
  } finally {
    if (testEmail) {
      await connection.query("DELETE FROM `User` WHERE `email` = ?", [
        testEmail,
      ]);
    }
  }
});

after(async () => {
  await connection.end();
});
