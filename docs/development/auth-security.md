# Authentication, settings and authorization

Audit for [#1162](https://github.com/NIPKaart/core/issues/1162), 2026-09-07. Dependencies #1159, #1160 and #1161 are closed. Production password defaults and their registration/reset/update regression tests already shipped in #1184.

## Decisions

**Fortify adoption: no in this change.** Retain the existing Laravel authentication controllers, routes and Inertia pages. A provider migration changes registration, session handling, reset responses and generated frontend actions; starter parity alone does not justify that change. A later Fortify migration requires a separately approved implementation decision and preservation of the contracts below.

**TOTP: preferred direction for #269, deferred implementation.** Replace the old custom/SMS OTP proposal with Fortify's supported TOTP flow when the provider migration is approved. Enrollment must confirm a valid code before activation; challenge, recovery codes, disabling, throttling and suspended-account rejection need dedicated tests. There is no established SMS requirement. This audit does not enable 2FA.

**Passkeys: separate evaluation, no implementation now.** Decide enrollment, recovery, relying-party/domain configuration, supported browsers and passwordless-account deletion/reauthentication before enabling WebAuthn. TOTP approval does not implicitly approve passkeys.

**Spatie: keep v7.** Roles and permissions stay in Spatie; resource/action decisions stay in policies invoked on the server. No v8 upgrade, policy replacement or role migration is needed for this hardening. A future v8 PR must compare configuration, published migrations and custom-model contracts. Frontend visibility is only UX.

## Route/controller matrix

All routes below use the web middleware, including locale and suspended-user handling. Existing URLs and route names are retained. Fortify comparison uses the current [starter provider](https://github.com/laravel/react-starter-kit/blob/main/app/Providers/FortifyServiceProvider.php), [starter settings routes](https://github.com/laravel/react-starter-kit/blob/main/routes/settings.php) and [Fortify documentation](https://laravel.com/docs/13.x/fortify), inspected on the audit date. Those upstream main-branch links can change.

| NIPKaart route(s)                                     | Existing controller                           | Protection / decision                                                                    | Fortify starter equivalent                                                                  |
| ----------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GET/POST `/register`                                  | RegisteredUserController                      | Guest; shared password defaults; explicit locale and default user role                   | Fortify registration + CreateNewUser action                                                 |
| GET/POST `/login`                                     | AuthenticatedSessionController / LoginRequest | Guest; five failed attempts per normalized email/IP; session regeneration                | Fortify login pipeline; named login limiter                                                 |
| POST `/logout`                                        | AuthenticatedSessionController                | Auth; logout, session invalidation and CSRF token regeneration                           | Fortify logout                                                                              |
| GET/POST `/forgot-password`                           | PasswordResetLinkController                   | Guest; broker per-account resend throttle; generic response retained                     | Fortify reset-link request                                                                  |
| GET `/reset-password/{token}`, POST `/reset-password` | NewPasswordController                         | Guest; broker token validation; shared password defaults                                 | Fortify reset action                                                                        |
| GET `/verify-email`                                   | EmailVerificationPromptController             | Auth; must remain accessible before verification                                         | Fortify verification prompt                                                                 |
| GET `/verify-email/{id}/{hash}`                       | VerifyEmailController                         | Auth, signed URL, six/minute                                                             | Fortify verification endpoint                                                               |
| POST `/email/verification-notification`               | EmailVerificationNotificationController       | Auth, six/minute                                                                         | Fortify resend endpoint                                                                     |
| GET/POST `/confirm-password`                          | ConfirmablePasswordController                 | Auth; POST six/minute, records session confirmation                                      | Fortify password confirmation                                                               |
| GET `/settings`, GET/PATCH `/settings/profile`        | ProfileController / redirect                  | Auth; PATCH six/minute; changing email requires current password and clears verification | Starter also leaves profile editing available before verification                           |
| DELETE `/settings/profile`                            | ProfileController                             | Auth, current password on every request, six/minute                                      | Starter additionally requires verified email                                                |
| GET/PUT `/settings/password`                          | PasswordController                            | Auth + verified; PUT current password on every request and six/minute                    | Starter security page requires recent confirmation; update requires verified and six/minute |
| GET `/settings/appearance`                            | Inertia route                                 | Auth; no password challenge or throttle for a preference page                            | Starter requires verified                                                                   |
| PATCH `/settings/locale`                              | LocaleController                              | Auth; allowlisted locale; no password challenge                                          | NIPKaart-specific                                                                           |

## Intentional settings boundaries

Profile access remains available before verification so users can correct a mistyped email and resend verification. Name and language changes need no password. Email changes require the current password in the same submission, including when the session already has recent confirmation; the credential is validated but never mass-assigned. The profile UI reveals this field when the address differs and clears it after success.

Password settings require verified email. Existing password-reset recovery remains available independently. Account deletion intentionally remains available to unverified users: a mistyped or inaccessible mailbox should not prevent account removal. Deletion still requires the current password on every attempt. Appearance and locale remain available without verification so users can understand and complete verification.

No additional `password.confirm` redirect is added: all three sensitive mutations check the current password directly. This is stronger freshness than a reusable recent-confirmation session, and avoids interrupting a PATCH/PUT/DELETE submission with a GET-only intended redirect. The existing password page exposes no secrets, recovery codes or credentials, so its GET needs no separate password challenge. A future security page showing 2FA/recovery/passkey controls must reconsider that boundary.

Profile updates, account deletion and password updates are limited to six requests per minute using Laravel's authenticated-user throttle with a `settings` key prefix. Failed validation consumes attempts; a seventh request returns 429. All three settings mutations share a budget, separate from email verification and password confirmation. Registration and reset submission do not gain blanket endpoint throttles in this change; login, broker token checks and broker resend throttling remain as documented. Distributed abuse controls remain a separate operational concern.

## Preservation and validation

`User` retains MustVerifyEmail, locale, suspended state, HasRoles, parking spaces, favorites and confirmations. Registration still assigns the user role and selects a supported locale. Changing email invalidates verification; suspension middleware still logs users out before controllers execute. The settings request only persists name, email and locale, so submitted roles or suspension fields cannot elevate access.

Policies remain registered by Laravel convention for ParkingSpace, ParkingSpaceConfirmation, ParkingMunicipal, ParkingOffstreet, ParkingRule, Role and User. Existing controller Gate calls and request authorization remain in place. This audit adds a direct-request permission regression for role pages; it is not a comprehensive audit of every domain operation.

Coverage: existing Auth tests cover login/logout, registration, verification, reset, confirmation and production password requirements. BackendMiddlewareTest covers locale precedence and suspension. Settings tests cover password/deletion validation, email verification invalidation, rejected email changes, unverified-user recovery/preferences/deletion, verified password settings, throttling, suspension and direct policy enforcement.
