# Laravel Boost

Laravel Boost is adopted development tooling under [#1187](https://github.com/NIPKaart/core/issues/1187), rather than an undecided candidate in [#1167](https://github.com/NIPKaart/core/issues/1167). It provides application-aware Laravel guidance and a local MCP server; it adds no production AI feature.

Install the locked dependencies with `composer install`. The supported `php artisan boost:install` flow has been run for Claude Code, Codex and Copilot. `boost.json` records the selected agents, packages and skills. Commit the reviewed generated instructions, skills and portable MCP configurations alongside their sources. Other developers can use the committed files without repeating the interactive installer.

`composer update` runs `scripts/update-boost.php` from `post-update-cmd`. This invokes `boost:update --ansi --no-interaction --no-discover` and propagates failures. Review and commit resulting guidance changes with dependency updates. Explicit discovery of new integrations remains an interactive `php artisan boost:update --discover` choice. The hook exits before bootstrapping Laravel when Composer sets `COMPOSER_DEV_MODE=0`, so `composer update --no-dev` does not require Boost. Normal `composer install --no-dev` does not invoke the update hook either.

## Guidance ownership

`.ai/guidelines/nipkaart.md` is the maintained source for NIPKaart architecture and links to durable domain/development documentation. Boost incorporates it in the generated agent instructions. Edit that source rather than the generated `<laravel-boost-guidelines>` sections. Existing instructions outside those sections are retained by Boost. Framework and package guidance is regenerated from installed dependencies; review upstream changes for conflicts with the project conventions. The selected Laravel Cloud skill is sourced from `.ai/skills/deploying-laravel-cloud`; its presence does not select a deployment platform for NIPKaart.

Run `php artisan boost:update --no-interaction --no-discover` twice after changing the source or dependencies. With the same inputs the second run should leave the generated files unchanged. Commit only portable instructions: no `.env` contents, credentials, local absolute paths or developer-specific overrides. Keep optional local MCP executable overrides out of commits.

The committed MCP configuration runs `php artisan boost:mcp` from the repository root, using a compatible host PHP installation. For DDEV-only PHP/database access, configure the agent locally to run `ddev exec php artisan boost:mcp` instead. MCP installation and startup are development steps; production uses `composer install --no-dev`.

Reference: [official Laravel Boost installation and update workflow](https://github.com/laravel/docs/blob/13.x/boost.md). The installed Boost 2.7 command supports `--no-discover`; this is explicit because discovery defaults can change between versions.
