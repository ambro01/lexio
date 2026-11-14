// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response);
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["generate redirects anonymous user", () => request("/generate"), { status: 302, location: "/auth/signin" }],
  ["add redirects anonymous user", () => request("/add"), { status: 302, location: "/auth/signin" }],
  ["proposals API rejects anonymous user", () => request("/api/ai/proposals", { method: "POST" }), { status: 401 }],
  ["word-fill API rejects anonymous user", () => request("/api/ai/word-fill", { method: "POST" }), { status: 401 }],
  [
    "proposal-sets API rejects anonymous user",
    () => request("/api/proposal-sets", { method: "POST" }),
    { status: 401 },
  ],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "update-password rejects anonymous user",
    () => request("/api/auth/update-password", { method: "POST", form: { password: "New-Smoke-Passw0rd!" } }),
    { status: 302, location: "/auth/forgot-password?error=" },
  ],
  ["update-password page renders for anonymous user", () => request("/auth/update-password"), { status: 200 }],
  [
    "confirm rejects bad token",
    () => request("/auth/confirm?token_hash=bogus&type=recovery"),
    { status: 302, location: "/auth/forgot-password?error=" },
  ],
  [
    "confirm rejects non-recovery type",
    () => request("/auth/confirm?token_hash=bogus&type=signup"),
    { status: 302, location: "/auth/forgot-password?error=" },
  ],
  ["forgot-password page renders", () => request("/auth/forgot-password"), { status: 200 }],
  [
    "forgot-password accepts unknown email",
    () =>
      request("/api/auth/forgot-password", {
        method: "POST",
        form: { email: `smoke-unknown-${Date.now()}@example.com` },
      }),
    { status: 302, location: "/auth/forgot-password?sent=1" },
  ],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || actual.location.startsWith(expected.location));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
