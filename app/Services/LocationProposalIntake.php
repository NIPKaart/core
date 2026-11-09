<?php

namespace App\Services;

use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Support\LocationProposalSnapshot;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LocationProposalIntake
{
    /** Signs this close to each other end up in one proposal. */
    public const int BUNDLE_RADIUS_METRES = 25;

    /** A cheap latitude band around each sign before the exact distance, a little wider than the radius. */
    private const float BUNDLE_LATITUDE_DEGREES = 0.0003;

    public function __construct(private SourceRegistrar $registrar) {}

    /**
     * Reconcile one complete selection while the caller holds the dataset source lock.
     * A savepoint rolls back all chunks when a late record fails validation.
     */
    public function apply(DatasetSource $source, string $json, array $snapshot): void
    {
        $data = $snapshot['data'];
        $retrieved = $data['retrieved_at'];
        $latest = $source->last_proposal_retrieved_at;

        DB::transaction(function () use ($source, $json, $snapshot, $data, $retrieved, $latest): void {
            $points = LocationProposalSnapshot::points($json, $snapshot['recordsOffset'], $data);
            if ($latest !== null && $retrieved->lte($latest)) {
                foreach ($points as $_point) {
                    // Stale snapshots still have to pass validation.
                }

                return;
            }

            if ($source->last_proposal_source_count * 4 > $data['source_count'] * 5) {
                throw ValidationException::withMessages(['file' => 'Location proposal snapshot has an implausible count drop.']);
            }

            $timestamp = $retrieved->format('Y-m-d H:i:s.uP');
            $country = $data['source']['area']['country'];
            $municipalities = Municipality::where('code_scheme', 'nl-cbs')->whereHas('country', fn ($query) => $query->where('code', $country))
                ->pluck('id', 'code')->all();
            $reference = $country === 'NL' ? $this->dutchMunicipalityReference() : [];
            $batch = [];
            foreach ($points as $point) {
                $code = $point['municipality_code'];
                if (isset($reference[$code]) && ! array_key_exists($code, $municipalities)) {
                    $municipalities[$code] = $this->registrar->referenceMunicipality($reference[$code])?->id;
                }
                $batch[] = [
                    'dataset_source_id' => $source->id,
                    'external_id' => $point['external_id'],
                    'municipality_id' => $municipalities[$code] ?? null,
                    'municipality_code' => $point['municipality_code'],
                    'latitude' => $point['latitude'],
                    'longitude' => $point['longitude'],
                    'source_last_seen_on' => $point['source_last_seen_on'],
                    'under_sign_types' => json_encode($point['under_sign_types'], JSON_THROW_ON_ERROR),
                    'personal' => $point['personal'],
                    'last_seen_at' => $timestamp,
                    'missing_since' => null,
                ];
                if (count($batch) === 500) {
                    $this->write($batch);
                    $batch = [];
                }
            }
            if ($batch !== []) {
                $this->write($batch);
            }

            DB::table('location_proposal_points')->where('dataset_source_id', $source->id)
                ->where('last_seen_at', '<', $timestamp)->whereNull('missing_since')
                ->update(['missing_since' => $timestamp]);

            $this->assignProposals($source);
            $source->forceFill([
                'last_proposal_retrieved_at' => $retrieved,
                'last_proposal_source_count' => $data['source_count'],
            ])->save();
        });
    }

    private function write(array $batch): void
    {
        DB::table('location_proposal_points')->upsert($batch, ['dataset_source_id', 'external_id'], [
            'municipality_id', 'municipality_code', 'latitude', 'longitude', 'source_last_seen_on',
            'under_sign_types', 'personal', 'last_seen_at', 'missing_since',
        ]);
    }

    private function assignProposals(DatasetSource $source): void
    {
        $this->syncProposalMunicipalities($source);
        // Individual proposals start with the ID of their first point. A point that
        // changes municipality leaves its former group and resumes its own proposal.
        DB::statement(<<<'SQL'
            INSERT INTO location_proposals (id, municipality_id, created_at)
            SELECT point.id, point.municipality_id, CURRENT_TIMESTAMP FROM location_proposal_points AS point
            LEFT JOIN location_proposals AS current ON current.id = point.location_proposal_id
            WHERE point.dataset_source_id = ? AND current.municipality_id IS DISTINCT FROM point.municipality_id
                AND point.municipality_id IS NOT NULL AND NOT point.personal AND point.missing_since IS NULL
            ON CONFLICT (id) DO NOTHING
            SQL, [$source->id]);

        DB::statement(<<<'SQL'
            UPDATE location_proposal_points AS point
            SET location_proposal_id = point.id
            WHERE point.dataset_source_id = ?
                AND point.municipality_id IS NOT NULL AND NOT point.personal AND point.missing_since IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM location_proposals AS current
                    WHERE current.id = point.location_proposal_id AND current.municipality_id = point.municipality_id
                )
            SQL, [$source->id]);

        $this->syncProposalMunicipalities($source);
        $this->bundleNearbySigns($source);
    }

    /**
     * Signs close together usually mark the same parking spaces, so they become one proposal and the moderator draws
     * the bays once. Only untouched open proposals take part. A lone sign joins the nearest proposal within reach that
     * stays where it is: one that already holds several signs, or a lone sign with no earlier sign within reach. A
     * sign that loses its place in a chain this way is picked up by the next delivery.
     */
    private function bundleNearbySigns(DatasetSource $source): void
    {
        DB::statement(<<<'SQL'
            WITH open_point AS (
                SELECT point.id, point.location_proposal_id AS proposal, point.municipality_id, point.latitude,
                    ST_SetSRID(ST_MakePoint(point.longitude, point.latitude), 4326)::geography AS place,
                    (SELECT count(*) FROM location_proposal_points AS other
                        WHERE other.location_proposal_id = point.location_proposal_id
                            AND NOT other.personal AND other.missing_since IS NULL) = 1 AS lone
                FROM location_proposal_points AS point
                JOIN location_proposals AS proposal ON proposal.id = point.location_proposal_id
                WHERE point.dataset_source_id = ? AND point.municipality_id IS NOT NULL
                    AND NOT point.personal AND point.missing_since IS NULL
                    AND proposal.closed_at IS NULL AND proposal.bays_published_at IS NULL AND proposal.decision_revision = 0
            ),
            anchor AS (
                SELECT * FROM open_point WHERE id = proposal
            ),
            root AS (
                SELECT anchor.* FROM anchor
                WHERE NOT anchor.lone OR NOT EXISTS (
                    SELECT 1 FROM anchor AS earlier
                    WHERE earlier.municipality_id = anchor.municipality_id AND earlier.id < anchor.id
                        AND abs(earlier.latitude - anchor.latitude) < ? AND ST_DWithin(earlier.place, anchor.place, ?)
                )
            ),
            staying AS (
                SELECT root.* FROM root
                WHERE NOT root.lone OR NOT EXISTS (
                    SELECT 1 FROM root AS bundle
                    WHERE NOT bundle.lone AND bundle.municipality_id = root.municipality_id
                        AND abs(bundle.latitude - root.latitude) < ? AND ST_DWithin(bundle.place, root.place, ?)
                )
            ),
            target AS (
                SELECT DISTINCT ON (sign.id) sign.id, staying.proposal
                FROM anchor AS sign
                JOIN staying ON staying.municipality_id = sign.municipality_id AND staying.id <> sign.id
                    AND abs(staying.latitude - sign.latitude) < ? AND ST_DWithin(staying.place, sign.place, ?)
                WHERE sign.lone
                ORDER BY sign.id, ST_Distance(staying.place, sign.place), staying.id
            )
            UPDATE location_proposal_points AS point SET location_proposal_id = target.proposal
            FROM target WHERE point.id = target.id
            SQL, [
            $source->id,
            self::BUNDLE_LATITUDE_DEGREES, self::BUNDLE_RADIUS_METRES,
            self::BUNDLE_LATITUDE_DEGREES, self::BUNDLE_RADIUS_METRES,
            self::BUNDLE_LATITUDE_DEGREES, self::BUNDLE_RADIUS_METRES,
        ]);
    }

    private function syncProposalMunicipalities(DatasetSource $source): void
    {
        DB::statement(<<<'SQL'
            UPDATE location_proposals AS proposal SET municipality_id = point.municipality_id
            FROM location_proposal_points AS point
            WHERE point.dataset_source_id = ? AND point.id = proposal.id
                AND point.location_proposal_id = proposal.id AND point.municipality_id IS NOT NULL
                AND NOT point.personal AND point.missing_since IS NULL
                AND proposal.municipality_id <> point.municipality_id
            SQL, [$source->id]);
    }

    /** @return array<string, array> */
    private function dutchMunicipalityReference(): array
    {
        $reference = [];
        // CBS StatLine 86247NED, Gebieden in Nederland 2026 (code, name and ISO subdivision).
        $file = new \SplFileObject(resource_path('data/cbs-municipalities-2026.csv'));
        $file->setFlags(\SplFileObject::READ_CSV | \SplFileObject::SKIP_EMPTY | \SplFileObject::DROP_NEW_LINE);
        $file->setCsvControl(',', '"', '');
        foreach ($file as $row) {
            if (! is_array($row) || count($row) !== 3) {
                continue;
            }
            [$code, $name, $subdivision] = $row;
            $reference[$code] = [
                'country' => 'NL',
                'subdivision' => $subdivision,
                'municipality' => ['code' => $code, 'name' => $name, 'scheme' => 'nl-cbs'],
            ];
        }

        return $reference;
    }
}
