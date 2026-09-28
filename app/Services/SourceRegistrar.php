<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Jobs\ProcessDatasetDelivery;
use App\Models\Country;
use App\Models\DatasetDelivery;
use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Models\Province;
use App\Models\User;
use App\Notifications\DatasetImport\SourceAwaitingApproval;
use App\Support\SourceDescription;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Registers sources discovered in the import bucket and records the administrator's approval (ADR 0013).
 */
class SourceRegistrar
{
    /**
     * Registers an unknown dataset folder from a validated delivery envelope; the source waits for approval.
     *
     * @param  array<string, mixed>  $data
     */
    public function register(string $targetType, array $data): DatasetSource
    {
        return DB::transaction(function () use ($targetType, $data): DatasetSource {
            $existing = DatasetSource::where('code', $data['dataset'])->lockForUpdate()->first();
            if ($existing) {
                return $existing;
            }
            [$municipality, $error] = $this->findMunicipality($data['source']['area']);
            $source = DatasetSource::create([
                ...DatasetSource::attributesFromDescription($data['source']),
                'code' => $data['dataset'], 'selection' => $data['selection'], 'target_type' => $targetType,
                'municipality_id' => $municipality?->id,
            ]);
            $source->forceFill(['registration_error' => $error])->save();
            $this->notify($source);

            return $source;
        });
    }

    /**
     * Holds a source for re-approval when a delivery describes it differently from what was approved.
     *
     * @param  array<string, mixed>  $description
     */
    public function holdForReapproval(DatasetSource $source, array $description): void
    {
        DB::transaction(function () use ($source, $description): void {
            $source = DatasetSource::whereKey($source->id)->lockForUpdate()->firstOrFail();
            if ($source->pending_description !== null && SourceDescription::approvalFingerprint($source->pending_description) === SourceDescription::approvalFingerprint($description)) {
                return;
            }
            $source->forceFill(['approval_state' => 'pending', 'pending_description' => $description])->save();
            $this->notify($source);
        });
    }

    public function approve(DatasetSource $source, User $actor, ?string $reason): void
    {
        Gate::forUser($actor)->authorize('approve', $source);
        DB::transaction(function () use ($source, $actor, $reason): void {
            $source = DatasetSource::whereKey($source->id)->lockForUpdate()->firstOrFail();
            if ($source->pending_description !== null) {
                $source->fill(DatasetSource::attributesFromDescription($source->pending_description));
            }
            $area = $source->description['area'];
            [$municipality, $error] = $this->findMunicipality($area);
            if ($error !== null) {
                throw ValidationException::withMessages(['source' => $error]);
            }
            // A municipality is only added to the reference data once an administrator accepts the source.
            $municipality ??= Municipality::create([
                'name' => $area['municipality']['name'], 'code_scheme' => $area['municipality']['scheme'], 'code' => $area['municipality']['code'],
                ...$this->region($area),
            ]);
            $source->forceFill([
                'municipality_id' => $municipality->id, 'pending_description' => null, 'registration_error' => null,
                'approval_state' => 'approved', 'reviewed_by' => $actor->id, 'reviewed_at' => now(), 'review_reason' => $reason,
            ])->save();
        });
        $this->dispatchWaiting($source);
    }

    public function reject(DatasetSource $source, User $actor, ?string $reason): void
    {
        Gate::forUser($actor)->authorize('approve', $source);
        $source->forceFill(['approval_state' => 'rejected', 'reviewed_by' => $actor->id, 'reviewed_at' => now(), 'review_reason' => $reason])->save();
    }

    /**
     * Finds the municipality by official code, or links an existing one by name once. Countries and
     * subdivisions are reference data and are never created from a delivery.
     *
     * @param  array{country: string, subdivision: string, municipality: array{scheme: string, code: string, name: string}}  $area
     * @return array{0: ?Municipality, 1: ?string}
     */
    private function findMunicipality(array $area): array
    {
        $region = $this->region($area);
        if ($region === null) {
            return [null, "Land {$area['country']} of provincie {$area['subdivision']} is niet bekend in NIPKaart."];
        }
        $official = $area['municipality'];
        $municipality = Municipality::where('country_id', $region['country_id'])->where('code_scheme', $official['scheme'])->where('code', $official['code'])->first();
        if ($municipality) {
            return [$municipality, null];
        }
        $named = Municipality::where('country_id', $region['country_id'])->where('province_id', $region['province_id'])
            ->whereNull('code')->whereRaw('lower(name) = lower(?)', [$official['name']])->first();
        $named?->forceFill(['code_scheme' => $official['scheme'], 'code' => $official['code']])->save();

        return [$named, null];
    }

    /**
     * @param  array{country: string, subdivision: string}  $area
     * @return array{country_id: int, province_id: int}|null
     */
    private function region(array $area): ?array
    {
        $country = Country::where('code', $area['country'])->first();
        $province = $country ? Province::where('country_id', $country->id)->where('geocode', $area['subdivision'])->first() : null;

        return $province ? ['country_id' => $country->id, 'province_id' => $province->id] : null;
    }

    private function notify(DatasetSource $source): void
    {
        Notification::send(User::role(UserRole::ADMIN)->get(), (new SourceAwaitingApproval($source->id, $source->name))->afterCommit());
    }

    /** Deliveries received while the source waited are processed now. */
    private function dispatchWaiting(DatasetSource $source): void
    {
        DatasetDelivery::where('dataset_source_id', $source->id)->where('state', 'pending')->pluck('id')
            ->each(fn (int $id) => ProcessDatasetDelivery::dispatch($id)->afterCommit());
    }
}
