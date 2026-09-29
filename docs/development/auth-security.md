# Authentication, settings and authorization

Implementation for [#1162](https://github.com/NIPKaart/core/issues/1162), 2026-09-07. The owner explicitly approved Fortify, TOTP and passkeys after the initial hardening audit. This supersedes the earlier decision to defer migration. Dependencies #1159, #1160 and #1161 are closed; production password defaults remain those shipped in #1184.

## Architecture and decisions

**Fortify: adopted.** Fortify 1.39 owns authentication routes, controllers, login pipeline, password reset, email verification and password confirmation. The previous application auth controllers and LoginRequest are removed. NIPKaart supplies registration/reset actions, Inertia views, suspension checks and a generic reset-link response. Existing settings controllers retain application-specific profile, locale, deletion and password-update behavior, as in the current starter's separation of authentication from settings.

**TOTP: enabled, opt-in.** Users enroll an authenticator from Settings → Security, confirm a real code before protection becomes active, and save eight recovery codes. Password login challenges enrolled users before authenticating. A recovery code is replaced after use. Regeneration invalidates previous codes; disabling clears both secret and recovery codes. Secrets and recovery codes use Laravel encryption and are hidden from User serialization. Setup and recovery data are fetched on demand, not stored in Inertia history props. Sensitive auth responses use `no-store`.

**Passkeys: enabled, opt-in, separately approved.** Laravel's passkeys backend and official `@laravel/passkeys` client handle registration, login and confirmation. Users name and remove credentials in Security. A passkey is an alternative to password plus TOTP, not a third step: WebAuthn requires user verification (device PIN/biometrics) and discoverable credentials. Account creation still requires a password; email change, password update and account deletion still ask for that password. Password reset remains the recovery path, and does not disable TOTP or remove passkeys. Users should retain recovery codes and/or another registered device.

**Authorization: policies retained, Spatie upgraded to v8.3.0.** Policies decide domain resource/action access; Spatie stores roles and permissions; frontend visibility is UX only. The owner also approved the v8 upgrade. No policy replacement accompanies it.

The implementation follows the [Fortify documentation](https://laravel.com/docs/13.x/fortify), [starter settings routes](https://github.com/laravel/react-starter-kit/blob/main/routes/settings.php), and the installed [Laravel passkeys backend](https://github.com/laravel/passkeys-server/tree/a76656ada41b2b4a591f075eddae5ddc67e8ab9c). Small passkey action adapters translate invalid WebAuthn origin/challenge/signature/attestation failures into credential validation errors; cryptographic validation remains in the package. Unexpected database or infrastructure exceptions are not swallowed.

## Route/controller matrix

Existing browser URLs are retained using Fortify's `paths` configuration where needed. Route names follow Fortify: reset submission is now `password.update`; settings password update is `user-password.update` at the existing `/settings/password`. Wayfinder imports and tests use the corresponding package actions/names. No duplicate legacy login or reset endpoint remains.

| Routes                                                                                           | Owner                                                     | Boundary                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| GET/POST `/register`                                                                             | Fortify RegisteredUserController + CreateNewUser          | Guest; shared password policy; allowlisted locale; default user role assigned transactionally                               |
| GET/POST `/login`                                                                                | Fortify AuthenticatedSessionController and login pipeline | Guest; built-in five-failed-attempt email/IP limiter; suspension rejected before challenge/login; password rehash preserved |
| POST `/logout`                                                                                   | Fortify AuthenticatedSessionController                    | Auth; logout, invalidate session and regenerate CSRF token                                                                  |
| GET/POST `/forgot-password`                                                                      | Fortify PasswordResetLinkController                       | Guest; broker resend throttle; same generic response for existing/missing accounts                                          |
| GET `/reset-password/{token}`, POST `/reset-password`                                            | Fortify NewPasswordController + ResetUserPassword         | Guest; broker token validation; shared password defaults                                                                    |
| GET `/verify-email`                                                                              | Fortify EmailVerificationPromptController                 | Auth; available before verification                                                                                         |
| GET `/verify-email/{id}/{hash}`                                                                  | Fortify VerifyEmailController                             | Auth; signed URL; six/minute                                                                                                |
| POST `/email/verification-notification`                                                          | Fortify EmailVerificationNotificationController           | Auth; six/minute                                                                                                            |
| GET/POST `/confirm-password`                                                                     | Fortify ConfirmablePasswordController                     | Auth; POST six/minute; session confirmation; passkey alternative in the UI                                                  |
| GET `/user/confirmed-password-status`                                                            | Fortify ConfirmedPasswordStatusController                 | Auth                                                                                                                        |
| GET/POST `/two-factor-challenge`                                                                 | Fortify TwoFactorAuthenticatedSessionController           | Guest; pending login required; POST five/minute per challenged user; suspension rechecked                                   |
| POST/DELETE `/user/two-factor-authentication`                                                    | Fortify TwoFactorAuthenticationController                 | Auth, verified, recent confirmation; six/minute                                                                             |
| POST `/user/confirmed-two-factor-authentication`                                                 | Fortify ConfirmedTwoFactorAuthenticationController        | Auth, verified, recent confirmation; valid TOTP; six/minute                                                                 |
| GET `/user/two-factor-qr-code`, `/user/two-factor-secret-key`, `/user/two-factor-recovery-codes` | Fortify setup/recovery controllers                        | Auth, verified, recent confirmation; no-store                                                                               |
| POST `/user/two-factor-recovery-codes`                                                           | Fortify RecoveryCodeController                            | Auth, verified, recent confirmation; six/minute                                                                             |
| GET `/passkeys/login/options`, POST `/passkeys/login`                                            | Laravel PasskeyLoginController                            | Guest; ten/minute per IP; one-use session challenge; suspension authorization callback                                      |
| GET `/passkeys/confirm/options`, POST `/passkeys/confirm`                                        | Laravel PasskeyConfirmationController                     | Auth; ten/minute per user; credential ownership checked                                                                     |
| GET `/user/passkeys/options`, POST `/user/passkeys`                                              | Laravel PasskeyRegistrationController                     | Auth, verified, recent confirmation; ten/minute per user                                                                    |
| DELETE `/user/passkeys/{passkey}`                                                                | Laravel PasskeyRegistrationController                     | Auth, verified, recent confirmation; ownership enforced                                                                     |
| GET `/settings/security`                                                                         | NIPKaart SecurityController                               | Auth, verified, recent confirmation; only passkey metadata and 2FA status in props                                          |
| GET `/settings`, GET/PATCH `/settings/profile`                                                   | NIPKaart ProfileController / redirect                     | Auth; PATCH six/minute; current password for email changes                                                                  |
| DELETE `/settings/profile`                                                                       | NIPKaart ProfileController                                | Auth; current password; six/minute                                                                                          |
| GET/PUT `/settings/password`                                                                     | NIPKaart PasswordController                               | Auth, verified; PUT current password and six/minute                                                                         |
| GET `/settings/appearance`, PATCH `/settings/locale`                                             | NIPKaart settings routes / LocaleController               | Auth; allowlisted locale; no password challenge                                                                             |

## Preserved behavior and intentional boundaries

Profile access remains available before verification so a mistyped email can be corrected. Email changes require the current password even after recent confirmation, clear verification, and only persist name/email/locale. Name/language changes need no password. Account deletion remains available to unverified users with their password and cascades to passkeys. The password settings page requires verification; appearance and locale remain available so users can complete verification in their language.

All three profile/password/deletion mutations share a six/minute user budget with the `settings` prefix, isolated from verification. Fortify management/password-confirmation POSTs use a separate `security` budget. Package management routes receive the application's verified-email and throttle boundaries in the provider, including when routes are cached. The Security GET and package endpoints both require recent confirmation, so a direct request cannot bypass the UI gate.

`User` retains MustVerifyEmail, locale, suspended state, HasRoles, parking spaces, favorites and confirmations. Suspension middleware invalidates an existing session and pending TOTP login; password and passkey login also reject suspension before establishing a session. Policies remain in place for ParkingSpace, ParkingSpaceConfirmation, ParkingMunicipal, ParkingOffstreet, ParkingRule, Role and User.

## Moderator boundary

Implementation for [#1314](https://github.com/NIPKaart/core/issues/1314). The `moderator` role reviews community work without administrator powers. It may view parking rules, view/create/update community `ParkingSpace` records (including approving or rejecting its own submissions), remove confirmations, and hide or show municipal records. It cannot delete community parking, change offstreet records, view or manage users and roles, or operate dataset imports and sources; those remain administrator capabilities. Later community workflows (#1309–#1313) add their own moderation abilities to this role. Review decisions are attributable: whenever a moderator or administrator changes a community parking space's status, individually or in bulk, a `ParkingSpaceReview` records who changed it, from which status to which, and when. Reviews are kept as history, and the admin detail page shows the latest one. Edits that leave the status unchanged add no review. Deleting the reviewer's account keeps the review without its identity; permanently deleting the parking space deletes its reviews.

A suspended account has no abilities at all. A gate `before` check denies every policy and permission check for a suspended user, even when the role remains assigned. It is registered before Spatie's permission check so a role permission cannot grant access first. This complements the web middleware that logs suspended users out, and also covers authorization outside a request.

Roles and permissions are owned by code. `App\Enums\Permission` lists every permission with a translated label, description and group; `App\Enums\UserRole::permissions()` declares what each role holds (administrators hold every permission). `PermissionsTableSeeder` creates every permission, deletes stored permissions that are no longer declared (including their role and direct user assignments), and syncs each role to exactly its declaration, so a permission removed from a role is revoked on the next seed. After deploying a permission change, run `php artisan db:seed --class=PermissionsTableSeeder --force`. Permissions added to a role outside the code are removed by that run.

The application therefore no longer creates, edits or deletes roles. `/app/roles` is a read-only overview for holders of `role.view_any`: a card per role with its description, user count and permission count, a permission matrix grouped per resource, and a warning that lists missing or unknown roles and permissions whenever the database has drifted from the code. Assign a role to a user from user management. The former `role.view`, `role.create`, `role.update` and `role.delete` permissions are not declared anymore; the next seed deletes them. Roles that exist only in the database are not deleted automatically; the overview lists them as unknown.

## User overview

The user list shows when each user last signed in. `RecordLastLogin` stores `users.last_login_at` on Laravel's `Login` event, so password, two-factor, passkey and remember-me sign-ins all count; existing users show no recorded sign-in until their next login. The session table is deliberately not used for this, because logout and session expiry delete its rows. Facet filters narrow the list by role (including users without a role), suspension, email verification and sign-in (last 30 days or none recorded); each option shows how many users match it.

## Community account lifecycle

Implementation for [#1209](https://github.com/NIPKaart/core/issues/1209).

**Eligibility.** Every community action (opening and submitting the add form, confirming a place, and later improving and reporting) uses the `community` middleware group: `auth`, `verified` and `can:contribute`. The `contribute` ability is `User::isEligibleForCommunity()`: email verified and not suspended. Guests are sent to sign in, unverified accounts to email verification, and suspended accounts are signed out. Adding a place previously worked without an account; that is no longer possible. Moderation routes sit behind `auth` and `verified`, and the suspension gate check denies every ability to suspended accounts.

**Suspension.** Suspension remains a manual administrator action. Suspending requires a reason (at most 500 characters). Each suspension is kept in `user_suspensions` with who suspended, why and when, and who lifted it and when; `users.suspended_at` remains the fast state flag. The user list shows the reason of an active suspension. Suspension does not delete, reject or otherwise resolve the user's pending contributions.

**Account deletion.** Deleting an account, by the user or by an administrator, runs in one transaction and:

- deletes the user's pending and rejected (including trashed) parking spaces, with their confirmations, reviews and other users' favorites of them;
- keeps approved parking spaces as community facts, clearing `user_id` and `ip_address`;
- deletes the user's favorites, confirmations, passkeys, suspension history and notifications;
- keeps review and suspension records the user made about others, without their identity.

Saved destinations (#1316) and contributor reliability (#1256) do not exist yet; they must be removed with the account when they are built.

## Deployment and recovery

Run the two additive migrations before exposing the new code: nullable 2FA fields on users and a passkeys table with an account-deletion foreign key. Existing passwords, roles, locale and relationships require no data rewrite; users initially have neither 2FA nor passkeys. Do not roll back the schema after people enroll without an explicit plan for losing those credentials.

`APP_URL` must be the canonical HTTPS origin (scheme, host and optional port, no path); it defines both the WebAuthn relying-party host and allowed origin. Localhost is suitable for browser testing. Do not enroll production passkeys on a temporary preview domain. A relying-party/domain change can strand existing passkeys. `PASSKEYS_USER_HANDLE_SECRET` may be supplied as a stable dedicated secret; its fallback is `APP_KEY`. Keep the chosen value stable after enrollment. Preserve `APP_KEY` and encrypted-data backups for TOTP recovery. This PR does not change production settings or enroll production users.

Registration/login/confirmation use the supported browser client; cancellation and unsupported browsers display translated messages. Hardware authenticator/biometric prompts remain controlled by the browser and OS. TOTP and passkey backend tests use real generated codes and ES256 signatures; they do not establish compatibility with every physical authenticator or production origin.

## Validation

Existing Auth and Settings suites continue to cover registration, passwords, reset, verification, locale, suspension and policy enforcement. New tests cover confirmed TOTP enrollment, invalid codes, recovery-code consumption/regeneration, challenge throttling, suspension during challenge and generic reset responses. A software WebAuthn authenticator tests real registration, login and reauthentication, rejecting wrong origins/challenges/signatures, absent user verification, replayed/sessionless challenges, cross-user access and suspended accounts. Removal/verification gates and cascading deletion are covered separately.

Local validation completed with 102 tests / 439 assertions using cached routes, Pint, Prettier, ESLint, TypeScript and the DDEV production build. Chromium with a virtual authenticator exercised password confirmation, TOTP setup (including invalid-code feedback), recovery display, passkey enrollment, passkey login and passkey confirmation. The Dutch Security page was checked at 390px without horizontal overflow. Browser validation used only the dedicated test database.

## Spatie Permission v8 compatibility

Upgraded 7.4.2 to 8.3.0 following the [official upgrade guide](https://spatie.be/docs/laravel-permission/v8/upgrading). The v8 Role/Permission contracts accept `BackedEnum|string` for `findByName` and `findOrCreate`. `App\Models\Role` inherits these methods without overrides; User uses the package traits and Permission uses the package model, so no custom signatures need adaptation.

Compared the installed v7 and v8 config/migration stubs: both are unchanged between these versions. The published application config was older, so it now includes the default nullable `models.team` and `models.default_model` entries, current event class names and corrected wildcard-config comment. The application's custom Role model, disabled teams/events/wildcards, guard, table/column names and cache settings are retained.

The existing database migration has equivalent columns, primary/unique indexes and cascading foreign keys; differences from the v8 stub are helper syntax, comments and rollback idempotency. No schema migration or data rewrite is needed for Permission v8. Deployment should clear the permission cache with `php artisan permission:cache-reset` and rebuild the configuration cache using the normal deployment process.

Regression coverage exercises enum-based role lookup/assignment and server-side authorization after role-permission revocation, direct grants and direct-grant revocation. Existing Fortify registration and policy tests continue to validate the default role and authorization boundary.

After the Permission v8 upgrade, the full suite passed with 104 tests / 449 assertions.

## Create or promote an administrator

After migrations and the normal permission seeding, run this command in the target application's shell (locally use `ddev artisan` instead of `php artisan`; in production use the application's operator console):

```sh
php artisan nipkaart:make-admin admin@example.com --name="Administrator"
```

This follows DDS Platform's `dds:make-admin` flow. A new account is email-verified and receives the canonical `admin` role through Spatie Permission. Omitting `--password` generates a secure 24-character password, displayed only after successful creation. Store it immediately in a password manager; it cannot be retrieved by rerunning the command. The command does not send credentials by email or write them to seeders/configuration.

Without an email or new-account name, interactive execution prompts for them. For unattended execution, supply both and add `--no-interaction`; missing or invalid input fails without creating an account. Email addresses must be lowercase, consistent with registration. `--password` accepts an explicit password subject to the application's password policy, including production checks. Prefer generated passwords to avoid putting an explicit password into shell history or process arguments, and keep command output out of shared logs.

To promote an existing active user, or safely rerun for an administrator:

```sh
php artisan nipkaart:make-admin existing@example.com --no-interaction
```

Promotion preserves the name, password, verification state, locale, security settings, other roles and permissions. `--name` and `--password` only apply to new users and produce a warning when supplied for an existing account. Existing unverified users must still complete normal email verification. Suspended accounts are rejected, including suspended administrators; this command never lifts a suspension.

The command requires the existing `admin` role for the `web` guard. If it is missing, it exits unsuccessfully with setup instructions. Initialize the standard roles and permissions, then rerun:

```sh
php artisan db:seed --class=PermissionsTableSeeder
```

Production seeding may require Laravel's confirmation or `--force` when running non-interactively. The administrator command does not seed or overwrite role permissions automatically. User creation and role assignment run in one transaction, so a failed assignment leaves no partial bootstrap account.
