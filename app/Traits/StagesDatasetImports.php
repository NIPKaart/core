<?php

namespace App\Traits;

use App\Enums\UserRole;
use App\Events\DatasetDataChanged;
use App\Models\DatasetImport;
use App\Models\DatasetSource;
use App\Models\User;
use App\Notifications\DatasetImport\ReadyForReview;
use App\Support\MunicipalSnapshot;
use App\Support\SourceDescription;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Staging, idempotent delivery identity and the review decision shared by every dataset target type.
 * The using class supplies format decoding, record validation, comparison and publication.
 */
trait StagesDatasetImports
{
    /** @return array<string, mixed> */
    abstract protected function decodeSnapshot(string $json): array;

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    abstract protected function validateRecords(array $data, DatasetSource $source): array;

    /** @return array{rows: list<array<string, mixed>>, counts: array<string, int>, derivations: int, blockers: list<string>, token: string} */
    abstract public function review(DatasetImport $import, bool $lock = false): array;

    abstract protected function publish(DatasetImport $import, DatasetSource $source): void;

    /** @return array<string, mixed> */
    public function decodeDelivery(string $json): array
    {
        return $this->decodeSnapshot($json);
    }

    public function intake(string $json, User $actor): DatasetImport
    {
        Gate::forUser($actor)->authorize('create', DatasetImport::class);

        return $this->stage($json, $actor, $this->decodeSnapshot($json));
    }

    public function intakeFromStorage(string $json, string $dataset, string $deliveryId): DatasetImport
    {
        $data = $this->decodeSnapshot($json);
        if ($data['dataset'] !== $dataset || $data['delivery_id'] !== $deliveryId) {
            throw ValidationException::withMessages(['file' => 'Object identity does not match its contents.']);
        }

        return $this->stage($json, null, $data);
    }

    public function decide(DatasetImport $import, User $actor, string $decision, ?string $reason, string $reviewToken, bool $geometryReviewed = false): void
    {
        Gate::forUser($actor)->authorize('update', $import);
        DB::transaction(function () use ($import, $actor, $decision, $reason, $reviewToken, $geometryReviewed) {
            $source = DatasetSource::whereKey($import->dataset_source_id)->lockForUpdate()->firstOrFail();
            $import = DatasetImport::whereKey($import->id)->lockForUpdate()->firstOrFail();
            $import->setRelation('datasetSource', $source);
            if ($import->state !== 'pending') {
                throw ValidationException::withMessages(['decision' => 'Deze levering is al beoordeeld.']);
            }
            if ($decision === 'publish') {
                $review = $this->review($import, true);
                if ($review['blockers'] || ! hash_equals($review['token'], $reviewToken)) {
                    throw ValidationException::withMessages(['decision' => $review['blockers'] ?: ['De gegevens zijn veranderd. Bekijk de verschillen opnieuw.']]);
                }
                if ($review['derivations'] > 0 && ! $geometryReviewed) {
                    throw ValidationException::withMessages(['geometry_reviewed' => 'Bevestig dat je de afgeleide geometrieën hebt beoordeeld.']);
                }
                $this->publish($import, $source);
                $source->last_published_retrieved_at = $import->retrieved_at;
                $source->save();
            } elseif ($decision !== 'reject') {
                throw ValidationException::withMessages(['decision' => 'Ongeldige beslissing.']);
            }
            $import->forceFill(['state' => $decision === 'publish' ? 'published' : 'rejected', 'reviewed_by' => $actor->id, 'review_reason' => $reason, 'reviewed_at' => now()])->save();
            DatasetDataChanged::dispatch('imports', $source->target_type);
        });
    }

    /** @param array<string, mixed> $data */
    private function stage(string $json, ?User $actor, array $data): DatasetImport
    {
        $source = DatasetSource::where('code', $data['dataset'])->first();
        if (! $source || ! $source->isApproved()) {
            throw ValidationException::withMessages(['dataset' => 'Deze bron is nog niet ontdekt of goedgekeurd.']);
        }
        if (SourceDescription::approvalFingerprint($data['source']) !== SourceDescription::approvalFingerprint($source->description)) {
            throw ValidationException::withMessages(['source' => 'De bronbeschrijving wijkt af van de goedgekeurde bron. Keur de bron eerst opnieuw goed.']);
        }
        $fingerprint = hash('sha256', $json);
        $existing = DatasetImport::where('dataset_source_id', $source->id)->where('delivery_id', $data['delivery_id'])->first();
        if ($existing) {
            return $this->existingDelivery($existing, $fingerprint);
        }
        $configuration = $source->configuration();
        $records = $this->validateRecords($data, $source);

        return DB::transaction(function () use ($source, $configuration, $records, $data, $fingerprint, $actor) {
            $source = DatasetSource::whereKey($source->id)->lockForUpdate()->firstOrFail();
            $existing = DatasetImport::where('dataset_source_id', $source->id)->where('delivery_id', $data['delivery_id'])->first();
            if ($existing) {
                return $this->existingDelivery($existing, $fingerprint);
            }
            if (MunicipalSnapshot::fingerprint($source->configuration()) !== MunicipalSnapshot::fingerprint($configuration)) {
                throw ValidationException::withMessages(['dataset' => 'De datasetconfiguratie is gewijzigd. Lees het bestand opnieuw in.']);
            }

            $import = DatasetImport::create([
                'dataset_source_id' => $source->id, 'delivery_id' => $data['delivery_id'],
                'fingerprint' => $fingerprint, 'retrieved_at' => $data['retrieved_at'],
                'dataset_config' => $configuration, 'records' => $records, 'submitted_by' => $actor?->id,
            ])->refresh();

            Notification::send(User::role(UserRole::ADMIN)->get(), (new ReadyForReview($import->id, $source->name))->afterCommit());

            return $import;
        });
    }

    private function existingDelivery(DatasetImport $import, string $fingerprint): DatasetImport
    {
        if ($import->fingerprint !== $fingerprint) {
            throw ValidationException::withMessages(['delivery_id' => 'Deze leverings-ID is al gebruikt voor andere inhoud.']);
        }

        return $import;
    }
}
