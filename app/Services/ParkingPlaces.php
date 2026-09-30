<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingSpace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Resolves the parking places users can confirm or report, identified by their source and source identifier.
 *
 * Garages are facilities rather than individual places, so only community and municipal places qualify.
 */
class ParkingPlaces
{
    public const SOURCES = ['community', 'municipal'];

    /**
     * The place with this identity, if the public map shows it.
     *
     * @return Builder<ParkingSpace>|Builder<ParkingMunicipal>
     */
    public function published(string $source, string $id): Builder
    {
        return match ($source) {
            'community' => $this->place($source, $id)->where('status', ParkingStatus::APPROVED),
            'municipal' => $this->place($source, $id)->where('visibility', true),
        };
    }

    /**
     * The place with this identity, whether or not it is public; a malformed community identifier is not found.
     *
     * @return Builder<ParkingSpace>|Builder<ParkingMunicipal>
     */
    public function place(string $source, string $id): Builder
    {
        return match ($source) {
            'community' => ParkingSpace::whereKey(Str::isUuid($id) ? $id : abort(404)),
            'municipal' => ParkingMunicipal::whereKey($id),
        };
    }
}
