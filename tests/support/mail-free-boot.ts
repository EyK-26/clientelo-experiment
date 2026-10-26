import { strict as assert } from "node:assert";
import { bootstrapApp, createAppServer } from "../../src/bootstrap/createApp";
import { closeDatabase } from "../../src/bootstrap/database";
for (const key of [
  "MIGRATION_DATABASE_URL",
  "RESEND_API_KEY",
  "MAIL_HOST",
  "TEST_RECIPIENT_EMAIL",
  "MAIL_FROM",
])
  assert(!process.env[key]);
const app = await bootstrapApp({ migrate: false });
const server = createAppServer(app.routes, 0, undefined, {
  hostname: "127.0.0.1",
});
try {
  const headers = { Host: "native.clientelo.test" };
  for (const path of ["/etf", "/etf-preview"])
    assert.equal(
      (await fetch(new URL(path, server.url), { headers })).status,
      200,
    );
  for (const path of ["/resource/checklist", "/controlled/contact"])
    assert.equal(
      (await fetch(new URL(path, server.url), { headers })).status,
      404,
    );
  const post = await fetch(new URL("/etf", server.url), {
    method: "POST",
    headers,
    body: new URLSearchParams({ email: "synthetic@example.test" }),
  });
  assert.notEqual(post.status, 200);
  console.log(
    "Mail-free native generated boot passed; no mail/admin configuration or public contact route.",
  );
} finally {
  await server.stop(true);
  await app.context.dispose();
  await closeDatabase();
}
