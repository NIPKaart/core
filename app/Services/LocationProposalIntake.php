<?php

namespace App\Services;

use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Support\LocationProposalSnapshot;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LocationProposalIntake
{
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
        // Each new sign starts with its own proposal ID. A sign that moves to another
        // municipality leaves a historical group and resumes its own proposal.
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
