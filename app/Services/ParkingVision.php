<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ParkingVision
{
    public const string SOURCE = 'nl-ndw-e6';

    private const string PATH = '/api/v1/validations';

    public function enabled(): bool
    {
        return filled(config('services.parking_vision.url')) && filled(config('services.parking_vision.key'));
    }

    /** @return array<string, mixed> */
    public function start(object $point): array
    {
        $key = $this->cacheKey($point);

        return Cache::lock($key.':submit', 15)->get(function () use ($point, $key): array {
            $current = $this->status($point);
            if (in_array($current['status'], ['queued', 'running', 'completed'], true)
                || ($current['status'] === 'unavailable' && Cache::has($key))) {
                return $current;
            }

            try {
                $response = $this->client()->post(self::PATH, [
                    'locationId' => $this->locationId($point),
                    'ndwProposalId' => $point->external_id,
                    'lat' => (float) $point->latitude,
                    'lon' => (float) $point->longitude,
                    'proposalRevision' => $this->revision($point),
                ]);
            } catch (ConnectionException) {
                return ['status' => 'unavailable'];
            }

            $id = $response->json('id');
            if ($response->status() !== 202 || ! Str::isUuid($id)) {
                return ['status' => 'unavailable'];
            }

            Cache::put($key, ['id' => $id], now()->addDays(7));

            return ['status' => 'queued'];
        }) ?: ['status' => 'queued'];
    }

    /** @return array<string, mixed> */
    public function status(object $point): array
    {
        $key = $this->cacheKey($point);
        $job = Cache::get($key);
        if ($job === null) {
            return ['status' => 'idle'];
        }
        if (isset($job['result'])) {
            return $job['result'];
        }

        try {
            $response = $this->client()->get(self::PATH.'/'.$job['id']);
        } catch (ConnectionException) {
            return ['status' => 'unavailable'];
        }

        if ($response->notFound()) {
            Cache::forget($key);

            return ['status' => 'idle'];
        }
        if (! $response->ok() || $response->json('locationId') !== $this->locationId($point)) {
            return ['status' => 'unavailable'];
        }

        $status = $response->json('status');
        if (in_array($status, ['queued', 'running', 'failed'], true)) {
            return ['status' => $status];
        }

        $result = $response->json('result');
        if ($status !== 'completed' || ! is_array($result) || ($result['ndwProposalId'] ?? null) !== $point->external_id) {
            return ['status' => 'unavailable'];
        }

        $summary = $this->summary($result);
        Cache::put($key, ['result' => $summary], now()->addHour());

        return $summary;
    }

    /** @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summary(array $result): array
    {
        $analyzed = (int) data_get($result, 'sources.mapillary.analyzed', 0);
        $selected = (int) data_get($result, 'sources.mapillary.selected', 0);
        $partial = $analyzed < $selected || data_get($result, 'sources.mapillary.unanalyzed', 0) > 0
            || ! empty(data_get($result, 'sources.mapillary.failedSources')) || ! empty(data_get($result, 'sources.mapillary.truncatedSources'));
        $board = match (data_get($result, 'board.status')) {
            'supported' => 'supported',
            'not_observed' => $analyzed > 0 && ! $partial ? 'not_observed' : 'inconclusive',
            default => 'inconclusive',
        };
        $bayCount = data_get($result, 'bayCount.value');
        $bays = data_get($result, 'bayGeometry.bays');
        $subsign = data_get($result, 'subsign.status');
        $match = data_get($result, 'board.ndwMatch');
        $ndwMatch = null;
        if (is_array($match) && in_array($match['status'] ?? null, ['ambiguous', 'other'], true)) {
            $distances = collect($match['candidates'] ?? [])
                ->filter(fn ($candidate) => is_array($candidate) && is_numeric($candidate['distanceMeters'] ?? null)
                    && $candidate['distanceMeters'] >= 0);
            $target = $distances->firstWhere('id', $result['ndwProposalId'] ?? null);
            $alternative = $distances->first(fn ($candidate) => ($candidate['id'] ?? null) !== ($result['ndwProposalId'] ?? null));
            $ndwMatch = [
                'status' => $match['status'],
                'targetDistance' => isset($target['distanceMeters']) ? round((float) $target['distanceMeters'], 1) : null,
                'alternativeDistance' => isset($alternative['distanceMeters']) ? round((float) $alternative['distanceMeters'], 1) : null,
            ];
            $board = 'inconclusive';
        }
        $imageIds = $ndwMatch !== null ? ($match['imageIds'] ?? []) : data_get($result, 'board.linkedImageIds', []);
        $views = collect(is_array($imageIds) ? $imageIds : [])
            ->filter(fn ($id) => is_string($id) && preg_match('/^\d{1,32}$/D', $id))
            ->unique()->take(6)->values()->all();
        $aerial = data_get($result, 'aerialBays.geojson.features');
        $mappedBays = data_get($result, 'aerialBays.status') === 'indicative' && is_array($aerial)
            ? count($aerial) : (data_get($result, 'bayGeometry.status') === 'indicative' && is_array($bays) ? count($bays) : 0);

        return [
            'status' => 'completed',
            'board' => $board,
            'linkedViews' => count((array) data_get($result, 'board.linkedImageIds', [])),
            'bayCount' => data_get($result, 'bayCount.status') === 'designated' && is_int($bayCount) && $bayCount >= 0 ? $bayCount : null,
            'mappedBays' => $mappedBays,
            'ndwMatch' => $ndwMatch,
            'views' => $views,
            'subsign' => in_array($subsign, ['plate', 'time', 'present', 'conflict'], true) ? $subsign : 'unknown',
            'coverage' => ['analyzed' => $analyzed, 'selected' => $selected, 'partial' => $partial],
        ];
    }

    private function locationId(object $point): string
    {
        return "nipkaart:{$point->location_proposal_id}:{$point->id}";
    }

    private function revision(object $point): string
    {
        return hash('sha256', json_encode([
            $point->external_id, $point->latitude, $point->longitude,
            $point->source_last_seen_on ?? null, $point->under_sign_types ?? null, $point->personal ?? null,
        ], JSON_THROW_ON_ERROR));
    }

    private function cacheKey(object $point): string
    {
        return 'parking-vision:'.hash('sha256', implode('|', [
            config('services.parking_vision.url'), $this->locationId($point), $this->revision($point),
        ]));
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl(config('services.parking_vision.url'))
            ->withToken(config('services.parking_vision.key'))
            ->acceptJson()->connectTimeout(2)->timeout(5)->withoutRedirecting();
    }
}
