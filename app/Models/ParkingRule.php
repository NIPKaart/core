<?php

namespace App\Models;

use App\Enums\RuleLinkStatus;
use Database\Factories\ParkingRuleFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A link to the official page with the parking rules for a whole country or for one municipality.
 *
 * NIPKaart points to the source and does not copy, summarise or interpret it. A municipality's own page takes precedence
 * over the country's; visitors only ever see one of the two.
 */
class ParkingRule extends Model
{
    /** @use HasFactory<ParkingRuleFactory> */
    use HasFactory;

    protected $table = 'parking_rules';

    protected $casts = [
        'nationwide' => 'boolean',
        'link_status' => RuleLinkStatus::class,
        'link_checked_at' => 'datetime',
        'link_failing_since' => 'datetime',
    ];

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'country_id',
        'municipality_id',
        'url',
        'nationwide',
    ];

    protected static function booted(): void
    {
        static::saving(function (ParkingRule $rule): void {
            $rule->nationwide = $rule->municipality_id === null;

            // A new address has not been checked yet; the previous outcome belonged to the old one.
            if ($rule->exists && $rule->isDirty('url')) {
                $rule->forceFill(['link_status' => null, 'link_http_status' => null, 'link_error' => null, 'link_final_url' => null, 'link_checked_at' => null, 'link_failing_since' => null]);
            }
        });
    }

    /**
     * The rule that applies to a place: the municipality's own source when it has one, otherwise the country's.
     */
    public static function applicableTo(?int $countryId, ?int $municipalityId): ?self
    {
        if ($countryId === null) {
            return null;
        }

        return static::query()
            ->with(['country:id,name', 'municipality:id,name'])
            ->where('country_id', $countryId)
            ->where(fn (Builder $scope) => $scope->whereNull('municipality_id')
                ->when($municipalityId !== null, fn (Builder $own) => $own->orWhere('municipality_id', $municipalityId)))
            ->orderByRaw('municipality_id is null')
            ->first();
    }

    /**
     * What a visitor sees: one link, whose it is and the site it leads to.
     *
     * @return array{url: string, scope: 'municipality'|'country', name: ?string, host: ?string}
     */
    public function forVisitors(): array
    {
        $host = parse_url($this->url, PHP_URL_HOST);

        return [
            'url' => $this->url,
            'scope' => $this->municipality_id === null ? 'country' : 'municipality',
            'name' => $this->municipality_id === null ? $this->country?->name : $this->municipality?->name,
            'host' => is_string($host) ? preg_replace('/^www\./', '', $host) : null,
        ];
    }

    /**
     * Get the country that owns the parking rule.
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the municipality that owns the parking rule.
     */
    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }
}
