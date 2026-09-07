<?php

namespace App\Services;

use App\Enums\ParkingStatus;
use App\Models\ParkingMunicipal;
use App\Models\ParkingOffstreet;
use App\Models\ParkingSpace;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class ParkingTextSearch
{
    /**
     * @return array{hits: list<array{id: string, type: string, index: string, lat: float, lng: float, label: string, sub: ?string, score: float, href: string}>, estimatedTotalHits: int}
     */
    public function search(string $text, int $limit): array
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text));
        if ($text === '') {
            return ['hits' => [], 'estimatedTotalHits' => 0];
        }

        $postcode = null;
        $free = preg_replace_callback('/\b([1-9][0-9]{3})\s?([a-z]{2})\b/iu', function (array $match) use (&$postcode): string {
            $postcode = strtoupper($match[1].$match[2]);

            return '';
        }, $text, 1);
        [$place, $free] = str_contains($free, ',') ? array_map('trim', explode(',', $free, 2)) : [null, trim($free)];
        if ($free === '' && ! $place && $postcode === null) {
            return ['hits' => [], 'estimatedTotalHits' => 0];
        }

        $union = null;
        foreach (['community' => ParkingSpace::class, 'municipal' => ParkingMunicipal::class, 'offstreet' => ParkingOffstreet::class] as $source => $model) {
            $table = (new $model)->getTable();
            $query = $model::query()
                ->leftJoin('municipalities as municipality', 'municipality.id', '=', $table.'.municipality_id')
                ->leftJoin('provinces as province', 'province.id', '=', $table.'.province_id')
                ->selectRaw("{$table}.id::text AS id, ?::text AS type, ?::text AS index, {$table}.latitude::double precision AS lat, {$table}.longitude::double precision AS lng", [$source, $table]);
            $query->where($table.'.'.($source === 'community' ? 'status' : 'visibility'), $source === 'community' ? ParkingStatus::APPROVED : true);
            $placeColumn = $source === 'community' ? $table.'.city' : 'municipality.name';
            if ($place !== null && $place !== '') {
                $query->whereRaw("lower({$placeColumn}) = lower(?)", [$place]);
            }
            if ($postcode !== null) {
                if ($source === 'community') {
                    $query->whereRaw("upper(replace({$table}.postcode, ' ', '')) = ?", [$postcode]);
                } elseif ($free === '' && ! $place) {
                    continue;
                }
            }

            $fields = match ($source) {
                'community' => ['street', 'city', 'postcode', 'suburb', 'neighbourhood', 'amenity', 'description'],
                'municipal' => ['street'],
                'offstreet' => ['name', 'url'],
            };
            $fields = array_map(fn (string $field): string => $table.'.'.$field, $fields);
            if ($source !== 'community') {
                array_push($fields, 'municipality.name', 'province.name');
            }
            $query->selectRaw("concat_ws(' ', ".implode(', ', $fields).') AS search_text');
            $label = match ($source) {
                'community' => "COALESCE(NULLIF(trim({$table}.street), ''), NULLIF(trim({$table}.city), ''), 'Community spot')",
                'municipal' => "COALESCE(NULLIF(trim(concat_ws(' ', {$table}.street, {$table}.number)), ''), 'Municipal spot')",
                'offstreet' => "COALESCE(NULLIF(trim({$table}.name), ''), 'Garage / P+R')",
            };
            $sub = $source === 'community'
                ? "COALESCE(NULLIF(trim({$table}.city), ''), NULLIF(trim({$table}.postcode), ''))"
                : "COALESCE(NULLIF(trim(municipality.name), ''), NULLIF(trim(province.name), ''))";
            $query->selectRaw("{$label} AS label, {$sub} AS sub");
            $branch = $query->toBase();
            $union = $union === null ? $branch : $union->unionAll($branch);
        }

        $query = DB::query()->fromSub($union, 'parking_records');
        foreach (preg_split('/\s+/u', $free, -1, PREG_SPLIT_NO_EMPTY) as $word) {
            $query->where(function (Builder $query) use ($word): void {
                $query->whereRaw('strpos(lower(search_text), lower(?)) > 0', [$word]);
                if (mb_strlen($word) >= 5 && preg_match('/^\p{L}+$/u', $word)) {
                    $query->orWhereRaw('public.word_similarity(?, search_text) >= 0.6', [$word]);
                }
            });
        }
        $rows = $query->select(['id', 'type', 'index', 'lat', 'lng', 'label', 'sub'])
            ->selectRaw('count(*) OVER () AS total')
            ->selectRaw('CASE WHEN strpos(lower(search_text), lower(?)) > 0 THEN 1 ELSE 0 END + public.word_similarity(?, search_text) AS score', [$free, $free])
            ->orderByDesc('score')->orderBy('label')->orderBy('type')->orderBy('id')
            ->limit(max(1, min(20, $limit)) * 2)->get();

        return [
            'hits' => $rows->map(function (object $row): array {
                $hit = (array) $row;
                unset($hit['total']);
                $hit['href'] = route($row->type === 'offstreet' ? 'garages' : 'location-map');

                return $hit;
            })->all(),
            'estimatedTotalHits' => (int) ($rows->first()->total ?? 0),
        ];
    }
}
