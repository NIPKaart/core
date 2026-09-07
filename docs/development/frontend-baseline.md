# Frontend baseline

Decision for #1161, 2026-09-07. Modernize and simplify the current map application, with mobile usability as the next product priority. The official Laravel React starter is a reference, not a replacement for NIPKaart's product code.

## SSR: remove for this stage

Render React in the browser. The current product centers on an interactive Leaflet map, with a garage overview planned. Public, indexable municipality and individual location pages are a future requirement, not a prerequisite for the current modernization.

Remove the dedicated SSR entry, SSR scripts and build configuration. Explicitly disable SSR in Laravel so the package default cannot silently enable requests to an absent Node service. There is no separate SSR service to operate for this baseline.

Reconsider server-rendered HTML when public location content must be immediately readable or indexed, or when measured mobile first-load performance justifies it. At that point compare Inertia SSR with Laravel-rendered public pages or prerendering. Keep that decision tied to actual content and performance requirements.

Feature tests use the application's SSR configuration, without a test-only override. The homepage test verifies that Laravel returns the Inertia page payload without server-rendered React markup. CI builds the client and runs the existing feature suite.

## Bootstrap and application behavior

Use Inertia 3 automatic rendering, Strict Mode and `withApp` for the QueryClient provider. Keep i18next initialized from the shared Laravel locale, Echo initialization, theme handling, Leaflet CSS and the existing query retry/cache defaults. Remove the manual React root and the obsolete explicit esbuild JSX configuration.

Strict Mode replays effects in development. Map controls retain their cleanup. The global system-theme listener stays owned by bootstrap instead of being removed by individual theme consumers. Settings navigation uses Inertia's URL instead of a browser-only rendering branch.

The explicit lazy page resolver currently returns the default component, as required by Inertia 3. Automatic page discovery through `@inertiajs/vite` and centralized layouts remain technical simplification candidates. Keep these outside this focused PR; migration should demonstrably reduce code and preserve behavior. Preserve translated page titles, breadcrumbs and the distinction between public, map, auth and backend layouts when evaluating migration.

## Other decisions

| Area | Direction |
| --- | --- |
| Vite Plus | Defer. Existing Vite, ESLint and Prettier work with DDEV and CI; replacement needs a demonstrated benefit. |
| React Compiler | Defer until measured map/mobile performance or a separate compatibility evaluation justifies adoption. |
| Wayfinder | Keep the supported `wayfinder({ formVariants: true })` integration and generated typed helpers. |
| DDEV | Preserve host `0.0.0.0`, strict port 5173, primary-URL asset origin and DDEV CORS matching. |
| i18next, QueryClient, Echo | Preserve behavior; usage cleanup belongs to the integration audit in #1166. |
| Radix/shadcn, fonts | Preserve during framework reconciliation; make visual choices during mobile UX work. |
| Toasts and forms | One app-level Sonner renderer and native Inertia flash; retain RHF for the map editor. See [forms and feedback audit](forms-feedback.md) (#1164). |
| Unrelated dependency majors | Excluded. |

A later mobile UX decision is whether map and garage list are separate destinations or alternate views sharing filters and selection. This does not block the framework cleanup.

## Validation

Run `npm run check` and `ddev exec env DB_HOST=db composer ci:test`. The latter now builds only the client and runs Pest. Browser smoke should cover home, map mount, zoom/hash behavior and navigation to login. Authenticated map editing and receipt of real Reverb events require separate fixtures.

Before SSR removal, DDEV Vite origin/CORS and development Strict Mode map navigation were verified. The development log reported an upstream missing CSS source map in `leaflet.locatecontrol`; it did not prevent map rendering. No dependency was changed for that warning.

Verified for this PR: `npm run check`, the DDEV production client build and 70 Pest tests (211 assertions) pass. After SSR removal, the homepage and client navigation to the map were checked in the browser.
