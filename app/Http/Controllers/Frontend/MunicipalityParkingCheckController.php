<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Municipality;
use App\Models\ParkingSpace;
use App\Models\User;
use App\Services\ParkingPlaces;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class MunicipalityParkingCheckController extends Controller
{
    public function __invoke(Request $request, ParkingPlaces $places, string $country, string $municipality): Response
    {
        $area = Municipality::query()->where('slug', $municipality)
            ->whereRelation('country', 'code', strtoupper($country))->firstOrFail();
        $source = $request->query('source');
        $id = $request->query('id');
        $hasTarget = $source !== null || $id !== null;
        abort_if($hasTarget && (! in_array($source, ParkingPlaces::SOURCES, true)
            || ! is_string($id) || $id === '' || strlen($id) > 255
            || ($source === 'community' && ! Str::isUuid($id))), 404);

        // Checking needs an account, so a guest signs in before seeing the first parking space.
        $user = $request->user();
        $advancing = $hasTarget && $request->boolean('next');
        $skipped = $advancing && $request->boolean('skipped');
        $target = null;
        if ($user !== null && (! $hasTarget || $advancing)) {
            $next = $this->next($places, $area, $user, $source, $id);
            if ($next !== null) {
                return to_route('areas.municipality.check', [$country, $municipality, ...$next, ...($skipped ? ['skipped' => 1] : [])])
                    ->header('Cache-Control', 'private, no-store');
            }
        } elseif ($user !== null) {
            $target = $places->published($source, $id)->whereBelongsTo($area)->first();
        }

        $state = match (true) {
            $user === null => 'sign_in',
            $target === null => $hasTarget && ! $advancing ? 'withdrawn' : 'empty',
            $target->isReportedBy($user) => 'reported',
            $target->isConfirmedTodayBy($user) => 'confirmed',
            default => 'ready',
        };

        return Inertia::render('frontend/areas/parking-check', [
            'area' => ['country' => $country, 'municipality' => $municipality],
            'name' => $area->name,
            'cursor' => $hasTarget ? ['source' => $source, 'id' => $id] : null,
            'state' => $state,
            'skipped' => $request->boolean('skipped') && $target !== null,
            'canContribute' => $user?->can('contribute') ?? false,
            'place' => $target === null ? null : [
                'source' => $source,
                'id' => (string) $target->getKey(),
                'street' => $target->street,
                'latitude' => $target->latitude,
                'longitude' => $target->longitude,
                'orientation' => $target->orientation?->label(),
                'under_sign' => $target instanceof ParkingSpace ? $target->under_sign?->label() : null,
                'last_confirmed_at' => $target->publicConfirmations($user)['last_confirmed_at'],
            ],
        ])->toResponse($request)->withHeaders(['Cache-Control' => 'private, no-store', 'X-Robots-Tag' => 'noindex']);
    }

    /** @return array{source: string, id: string}|null */
    private function next(ParkingPlaces $places, Municipality $area, ?User $user, ?string $source, ?string $id): ?array
    {
        // A source and primary key form a stable cursor even if the previous record has disappeared.
        foreach (ParkingPlaces::SOURCES as $candidateSource) {
            if ($source === 'municipal' && $candidateSource !== $source) {
                continue;
            }

            $query = $places->publishedFrom($candidateSource)->whereBelongsTo($area);
            if ($candidateSource === $source) {
                $query->where('id', '>', $id);
            }
            if ($user !== null) {
                $query->whereDoesntHave('confirmations', fn (Builder $confirmations) => $confirmations
                    ->whereBelongsTo($user)->whereDate('confirmed_at', now()->toDateString()))
                    ->whereDoesntHave('reports', fn (Builder $reports) => $reports->open()->whereBelongsTo($user));
            }

            $candidate = $query->orderBy('id')->value('id');
            if ($candidate !== null) {
                return ['source' => $candidateSource, 'id' => (string) $candidate];
            }
        }

        return null;
    }
}
