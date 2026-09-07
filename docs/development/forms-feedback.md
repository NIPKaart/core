# Forms, validation and feedback

Audit for #1164, 2026-09-07, after the Inertia 3 baseline in #1161. The inventory covers `resources/js` form elements, Inertia mutations, React Hook Form imports, validation schemas and notification calls; Laravel Form Requests and controller validation remain authoritative.

## Decision matrix

| Pattern and entry points | Current behaviour | Decision |
| --- | --- | --- |
| `pages/auth/{login,register,forgot-password,reset-password,confirm-password,two-factor-challenge,verify-email}` | Inertia `<Form>`, server errors, native input constraints, processing and password resets; password-reset/email status is inline | Keep; no additional client schema or toast for existing inline status |
| `pages/settings/{profile,password}`, `components/delete-user` | Inertia `<Form>`, inline field errors and saved state; account deletion requires a password in a dialog | Keep; preserve focus/reset behaviour and explicit destructive confirmation |
| `pages/settings/security` | Inertia forms for two-factor enable/confirm/disable, code regeneration and passkey deletion; native form plus WebAuthn SDK for passkey registration; fetch for secrets/codes | Keep SDK ceremony and inline busy/error state; ordinary Inertia forms cannot replace browser authenticator interaction |
| `pages/backend/form-user`, used by users create/edit | Inertia `<Form>`, role selection, server rules including email uniqueness and password confirmation | Keep; native required/email inputs provide immediate feedback |
| `pages/backend/form-role`, used by roles create/edit | Inertia `<Form>` plus local permission selection and hidden array fields | Keep; local selection state is useful, no duplicated validation schema |
| `pages/backend/form-parking-rules`, `components/modals/modal-parking-rule`, `pages/backend/parking-rules/index` | Inertia `<Form>` with country/municipality selection, nationwide toggle and hidden inputs; server checks geographic scope and uniqueness | Keep; useful conditional UX remains local, Laravel enforces integrity |
| `pages/backend/parking-spaces/edit`, `form-parking-space`, `components/card-{switch,radio-group}`, `components/ui/form` | Sole React Hook Form instance; controlled fields, map watches/setValue, server errors bridged with setError | Retain RHF intentionally. Remove redundant nested provider and client duration calculation; use the real request lifecycle for submitting state and clear stale server errors on resubmission |
| `pages/frontend/form/form-create-location`, `pages/frontend/map/create`, `components/modals/modal-add-parking` | Inertia `<Form>` inside responsive dialog/drawer, marker coordinates and reverse-geocoded address, server field/general errors | Keep map/address readiness and native numeric constraints; replace SweetAlert2 success acknowledgement with Sonner title/description, retaining the existing translated information |
| `pages/frontend/form/form-confirm-location`, map community modal | Inertia `<Form>`, local status/comment state, daily confirmation readiness and server field/general errors | Keep; success comes from the server flash and closes/resets the form through its existing callback |
| Admin table mutations: users/roles/rules, community and confirmation action hooks, municipal/offstreet visibility, bulk actions, notifications | `router` mutations; contextual client success/error callbacks or server flash; destructive actions use `ConfirmDialog` | Keep request-specific callbacks where the server does not emit a toast. Native server flash handles server-owned messages. One outcome must have one notification owner |
| Favorites, language switch, logout, search/filter controls, appearance preferences | Router actions or local state; favorites show saved state, removal can toast on failure; search/map reads use fetch/Query | Keep; these are actions/preferences/read interactions, not candidates for form-schema rewrites |
| Zod and `@hookform/resolvers` | No application imports, schemas or resolver configuration | Remove unused direct dependencies; retain RHF itself |
| Sonner / SweetAlert2 / Radix dialogs | Two layout-scoped toast renderers; SweetAlert2 used only for post-save success, not confirmation | One Sonner renderer in `app.tsx`, covering auth, public, map and admin layouts. Remove SweetAlert2. Retain Radix `ConfirmDialog`, password deletion dialog and domain modals |

The municipal controller has edit/update endpoints but no municipal edit form page in the current frontend; this audit does not invent a missing product flow. Contact is also an empty page, not an existing form.

## Feedback contract

Server-owned passive messages use `Inertia::flash('success' | 'error' | 'warning' | 'info', $message)` before returning a redirect. They arrive in `page.flash`, outside shared page props. `app.tsx` registers one global `flash` listener before Inertia initializes and owns one Sonner renderer. The listener also handles initial full-page loads, does not depend on layout mounting or React effects, and is disposed during Vite HMR. Inertia excludes flash from browser history so back/forward does not replay old notifications. Identical messages from separate responses remain separate notifications.

Client-only outcomes (clipboard, map submission's translated title/description, contextual bulk counts and actions without a server message) call Sonner from their action callback. Do not additionally emit server flash for those same outcomes. Errors attached to submitted fields belong in Inertia `errors`/`InputError` or RHF `setError`; they are not passive flash. Self-suspension now uses validation errors so Inertia calls `onError`, preventing the previous simultaneous success and error notifications.

Existing inline authentication status, saved indicators and WebAuthn errors remain inline. Confirmation asks for a decision **before** an action and may block it; a toast reports an outcome **after** the action. Success acknowledgement alone does not warrant a second dialog library.

## Precognition and immediate validation

Defer Precognition. The current forms submit relatively small payloads and already expose server errors; no measured need for live database validation justifies introducing more requests and middleware. User email uniqueness and parking-rule scope are possible future candidates if users struggle with late feedback. Preserve native required/type/min/max/length constraints, controlled selections and map readiness. Do not duplicate geographic relationships, permissions, uniqueness or domain rules in client schemas. If live server validation becomes necessary, use Inertia's supported Precognition integration and test that validation-only requests have no mutation side effects.

## References and verification

- [Inertia 3 flash data](https://inertiajs.com/docs/v3/data-props/flash-data), [events](https://inertiajs.com/docs/v3/advanced/events), [validation](https://inertiajs.com/docs/v3/the-basics/validation) and [forms](https://inertiajs.com/docs/v3/the-basics/forms); checked against installed adapter code, including initial-load flash dispatch.
- The Laravel starter-kit comparison in [frontend baseline](frontend-baseline.md) remains the framework baseline. The local DDS Platform `resources/js/app.tsx` also uses an application-level Toaster; its surrounding architecture is not copied.
- `tests/Feature/FormFeedbackTest.php` covers all four flash severities, partial reload delivery, consumption, repeated identical actions, real role validation/success, RHF editor server error correction/duration, and rejection of self-suspension. Existing Auth/Settings and DomainContracts tests cover security forms, geographic constraints, parking-rule scope, community submissions, confirmations and favorites.
- No form is rewritten solely for stylistic parity. Map geocoding, authenticated pointer interactions and WebAuthn hardware acceptance remain distinct from feature/build checks.

## Validation result

`ddev exec composer ci:lint` passes (Wayfinder generation, Pint, Prettier, ESLint, TypeScript). `ddev exec env DB_HOST=db composer ci:test` passes the production build and 130 Pest tests / 648 assertions. Regenerated Wayfinder types also exposed a stale `string | number` parking-space ID in the confirmation action hook; it now uses the domain's UUID string type. The build retains its existing unresolved background-image warning.

Browser smoke verified home-to-login navigation with one global Notifications region in both public and authentication layouts. The browser connection detached during the attempted invalid-login submission, so that interaction and authenticated map editor submission are not claimed as browser-tested. The corresponding server validation paths are feature-tested above.
