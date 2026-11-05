# Plan 08: admin access

5 November 2026. Baseline: `claude/slice-01-data-model`.

After this slice every `/api/admin/*` request is accepted only for a signed-in Cloudflare Access user whose email is in `staff_roles`, so slice 09 can build the admin screens on a gate that is already tested. Amma can open `/admin` on staging and see her own email.

## Spec

### Inputs and outputs

| Name                                | Type and unit                                            | Notes                                                                        |
| ----------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Cf-Access-Jwt-Assertion` header    | compact JWT, RS256                                       | Read first. Falls back to the `CF_Authorization` cookie.                     |
| `ACCESS_TEAM_DOMAIN`                | string, e.g. `ew.cloudflareaccess.com`                   | Wrangler var per environment (Q3). Empty or unset: admin answers 401.        |
| `ACCESS_AUD`                        | string, the Access application's AUD tag                 | Wrangler var per environment (Q3). Empty or unset: admin answers 401.        |
| `GET /api/admin/me` response        | `{ email: string (lower-case), role: 'owner'\|'admin' }` |                                                                              |
| `requireStaff(roles?)`              | Hono middleware                                          | Sets `c.get('staff')` = `{ email, role }`. 401 or 403 otherwise.             |
| `audit(c, action, type, id, data?)` | returns an unexecuted `D1PreparedStatement`              | Writes `audit_log` with the staff email, `Date.now()` ms and `data` as JSON. |

Checks, in order: token present; alg is RS256; `kid` known (keys from `https://<team>/cdn-cgi/access/certs`, cached 10 minutes, one refetch for an unknown kid but not more than once per 30 s); signature valid; `aud` contains `ACCESS_AUD`; `iss` equals `https://<team>`; `exp` is in the future (60 s leeway at most); `nbf` and `iat`, if present, not in the future beyond the leeway; `email` present. Then the lower-cased email must have a `staff_roles` row (and a role in the list, if one was given). No other header is read. `Cf-Access-Authenticated-User-Email` is never trusted. Responses: 401 `{error:"unauthorized"}` for no or invalid token (also a certs fetch failure and unset vars), 403 `{error:"forbidden"}` for a verified email without a staff role.

No new dependency: signatures are checked with WebCrypto (`RSASSA-PKCS1-v1_5`, SHA-256). Pure parts (base64url, JWT split, claim rules) are in `src/domain/access-jwt.ts`; key cache, verification, middleware and `audit` are in `src/worker/admin/`.

### Reference cases

Also normal tests in `tests/unit/access-jwt.test.ts` and `tests/unit/admin-access.test.ts`, pending Sathira's copy in `tests/reference/` (Q10). Tokens are signed in the test with a generated RSA key and the JWKS fetcher is injected.

| Case | Given                                                      | Expected                                 |
| ---- | ---------------------------------------------------------- | ---------------------------------------- |
| R1   | Valid token, email in `staff_roles`                        | 200 `{email, role}`                      |
| R2   | Valid token, email not in `staff_roles`                    | 403                                      |
| R3   | Wrong `aud`; wrong `iss`; expired by more than 60 s        | 401 each                                 |
| R4   | Signature from another key; payload edited after signing   | 401                                      |
| R5   | `alg: none`; `alg: HS256`                                  | 401                                      |
| R6   | No header and no cookie                                    | 401                                      |
| R7   | Token with a `kid` the certs do not list                   | 401                                      |
| R8   | Only `Cf-Access-Authenticated-User-Email` set              | 401                                      |
| R9   | `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` empty or missing      | 401 even with a valid token              |
| R10  | Token email `HELPER@EXAMPLE.COM`, row `helper@example.com` | 200 with the lower-case email            |
| R11  | `requireStaff(['owner'])` and an `admin` user              | 403                                      |
| R12  | `audit()` in a `batch()` with a change                     | one `audit_log` row with the staff email |
| R13  | `exp` 59 s ago / 61 s ago                                  | accepted / rejected                      |

### Properties

- [ ] No request without a verifying token ever reaches a handler behind `requireStaff` (approved: no)
- [ ] Any single-byte change to a valid token makes it fail verification (approved: no)

### Out of scope

Next (slice 09): state-changing admin routes (POST, PUT, PATCH, DELETE) must block CSRF, because the `CF_Authorization` cookie authenticates cross-site requests. Check `Origin` against the app's host and require a JSON content type.

Admin screens (slice 09; the `/admin` route here only shows the signed-in email). Seeding real staff emails (a command in `docs/deploying.md`, emails stay `FILL`). Per-action role rules beyond the `roles` argument. Revoking sessions (Access does that).

### How it is checked

- Tests: pure claim and decode rules in `tests/unit/access-jwt.test.ts`; middleware, key cache and `audit` against real local D1 in `tests/unit/admin-access.test.ts`.
- Manual (needs Q3 and Q4): open `https://<staging host>/admin` on a phone, log in with Google, see the email. Then log in with a Google account that is not in `staff_roles` and see "Not signed in as staff".
- Review failure modes: admin trusting a header; staff action with no `audit_log` row.

## Cloudflare Access setup (Sathira, Q3)

1. Zero Trust, Access, Applications, add a self-hosted application. Destinations: the learn host with paths `/admin` and `/api/admin` (add both, one entry each). Do this for staging and production separately.
2. Identity provider: Google. Policy: allow the specific staff emails only.
3. Session duration: one week (launch plan).
4. Copy the application's **AUD tag** and your team domain as the bare host, no scheme (e.g. `englishwind.cloudflareaccess.com`), into `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` for that environment in `wrangler.jsonc`, then deploy.
5. Seed the staff rows (`docs/deploying.md`, "Staff").

Until step 4 is done admin answers 401 for everyone.

## Steps

1. **Pure JWT rules.** `src/domain/access-jwt.ts` and its tests. Done when the claim table passes.
2. **Verifier, middleware, `audit`, `/api/admin/me`, vars.** `src/worker/admin/`, `routes/admin.ts`, wrangler vars, `pnpm types:worker`. Done when the Worker tests pass.
3. **Docs and `/admin` placeholder.** Staff seed command in `docs/deploying.md`; `/admin` shows the email.

## Decisions

- Wrangler `vars` are not inherited by `env` blocks, so each environment lists both vars (empty until Q3). Empty counts as unset.
- A certs fetch failure answers 401, not 500: the gate fails closed.
- The unknown-kid refetch has a 30 s floor so random `kid` values cannot make the Worker call Cloudflare on every request.
- The cookie is accepted as well as the header because Access sets both; the header wins.
- No ADR: this implements ADR 0004.
