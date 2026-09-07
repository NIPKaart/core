# Valkey in DDEV

DDEV uses `valkey/valkey:9.1`, following the dds-platform setup. The service and volume keep the name `redis`, so Laravel and Redis Insight can continue connecting to the same host. Laravel keeps its Redis-compatible `redis` driver, `phpredis` client and `REDIS_*` environment variables. The default database-backed cache, queue and sessions are unchanged.

After applying this change, run `ddev restart`. Verify the backend with `ddev redis-cli PING` and `ddev redis-cli INFO server`; the latter should report `server_name:valkey`. The existing `ddev redis-cli` (alias `ddev redis`) and `ddev redis-flush` commands now use `valkey-cli`.

When selecting a Redis-compatible Laravel store inside DDEV, use `REDIS_HOST=redis` and `REDIS_PORT=6379` in your local `.env`. The tracked `.ddev/.env.redis` selects Valkey, and the Compose fallback uses the same image. The backend helper's `valkey` and `valkey-alpine` aliases also select version 9.1.

Existing Redis persistence can be incompatible with Valkey. If startup fails with `Can't handle RDB format version 12`, stop the service and back up the Redis volume before deciding whether its data must be migrated or the local store may start empty. Preserve the original snapshot recoverably (for example as `dump.redis-rdb-v12`); do not delete it automatically. Avoid using `ddev redis-backend valkey` just to apply this change: that helper removes the existing volume when switching backends.
