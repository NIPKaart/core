#!/usr/bin/env bash
# Run inside the disposable CI PostGIS service; never against application data.
set -euo pipefail
export PGUSER="${POSTGRES_USER:?}" PGDATABASE="${POSTGRES_DB:?}"
if [[ "$PGDATABASE" != nipkaart_test ]]; then
    echo 'Backup rehearsal requires the disposable nipkaart_test database.' >&2
    exit 1
fi
rehearsal_dir=$(mktemp -d)
restore_database="nipkaart_restore_$$"
cleanup() {
    dropdb --if-exists "$restore_database"
    psql -v ON_ERROR_STOP=1 -c 'DROP TABLE IF EXISTS baseline_backup_probe' >/dev/null
    rm -rf "$rehearsal_dir"
}
# Refuse to overwrite any earlier fixture.
psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE baseline_backup_probe (id bigint PRIMARY KEY, location geography(Point,4326));
INSERT INTO baseline_backup_probe VALUES (1180, ST_SetSRID(ST_MakePoint(4.9,52.37),4326));
SQL
trap cleanup EXIT
pg_dump --format=custom --no-owner --no-acl --file="$rehearsal_dir/database.dump"
createdb "$restore_database"
pg_restore --exit-on-error --no-owner --no-acl --dbname="$restore_database" "$rehearsal_dir/database.dump"
for database in "$PGDATABASE" "$restore_database"; do
    psql -d "$database" -At -v ON_ERROR_STOP=1 > "$rehearsal_dir/$database.counts" <<'SQL'
SELECT format('SELECT %L, count(*) FROM %I.%I', tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
SQL
done
diff -u "$rehearsal_dir/$PGDATABASE.counts" "$rehearsal_dir/$restore_database.counts"
psql -d "$restore_database" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM baseline_backup_probe WHERE id = 1180 AND ST_SRID(location::geometry) = 4326 AND ST_X(location::geometry) = 4.9 AND ST_Y(location::geometry) = 52.37) THEN
        RAISE EXCEPTION 'Restored spatial point does not match';
    END IF;
    IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('parking_spaces', 'parking_municipal_spaces', 'parking_offstreet_spaces') AND column_name = 'location' AND is_generated = 'ALWAYS') <> 3 THEN
        RAISE EXCEPTION 'Restored generated parking locations are missing';
    END IF;
END $$;
SQL
echo 'Backup/restore verified: all public table counts and PostGIS objects match.'
