<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Meilisearch\Client;
use Meilisearch\Contracts\SearchQuery;

class SearchController extends Controller
{
    public function __construct(private Client $meili) {}

    public function search(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        if ($q === '') {
            return response()->json(['hits' => [], 'estimatedTotalHits' => 0]);
        }

        $limit = max(1, min(20, (int) $request->integer('limit', 10)));

        $cfg = [
            'parking_spaces' => [
                'type' => 'community',
                'route' => route('location-map'),
                'label' => fn (array $d) => $this->firstNonEmpty(
                    trim((string) ($d['street'] ?? '')),
                    trim((string) ($d['city'] ?? '')),
                    'Community space'
                ),
                'sub' => fn (array $d) => $this->nullIfEmpty(
                    $this->firstNonEmpty(
                        trim((string) ($d['city'] ?? '')),
                        trim((string) ($d['postcode'] ?? ''))
                    )
                ),
            ],
            'parking_offstreet_spaces' => [
                'type' => 'offstreet',
                'route' => route('garages'),
                'label' => fn (array $d) => $this->firstNonEmpty(
                    trim((string) ($d['name'] ?? '')),
                    'Garage / P+R'
                ),
                'sub' => fn (array $d) => $this->nullIfEmpty(
                    $this->firstNonEmpty(
                        trim((string) ($d['municipality_name'] ?? '')),
                        trim((string) ($d['province_name'] ?? ''))
                    )
                ),
            ],
            'parking_municipal_spaces' => [
                'type' => 'municipal',
                'route' => route('location-map'),
                'label' => fn (array $d) => $this->firstNonEmpty(
                    trim(implode(' ', array_filter([
                        (string) ($d['street'] ?? ''),
                        isset($d['number']) ? (string) $d['number'] : '',
                    ]))),
                    'Municipal space'
                ),
                'sub' => fn (array $d) => $this->nullIfEmpty(
                    $this->firstNonEmpty(
                        trim((string) ($d['municipality_name'] ?? '')),
                        trim((string) ($d['province_name'] ?? ''))
                    )
                ),
            ],
        ];

        $queries = array_map(
            fn (string $uid) => (new SearchQuery)->setIndexUid($uid)->setQuery($q)->setLimit($limit),
            array_keys($cfg)
        );

        $resp = $this->meili->multiSearch($queries);
        $hits = [];
        $total = 0;

        foreach ($resp['results'] as $r) {
            $index = (string) ($r['indexUid'] ?? 'unknown');
            $total += (int) ($r['estimatedTotalHits'] ?? 0);
            if (! isset($cfg[$index])) {
                continue;
            }

            $c = $cfg[$index];
            foreach ($r['hits'] as $doc) {
                $hits[] = [
                    'id' => $doc['id'] ?? null,
                    'index' => $index,
                    'type' => $c['type'],
                    'label' => ($c['label'])($doc),
                    'sub' => ($c['sub'])($doc),
                    'href' => $c['route'],
                    'lat' => $this->lat($doc),
                    'lng' => $this->lng($doc),
                    'score' => $this->score($doc),
                ];
            }
        }

        usort($hits, static fn (array $a, array $b) => (($b['score'] ?? 0) <=> ($a['score'] ?? 0)) ?: strcmp((string) $a['label'], (string) $b['label'])
        );

        return response()->json([
            'hits' => array_slice($hits, 0, $limit * 2),
            'estimatedTotalHits' => $total,
        ]);
    }

    private function lat(array $d): ?float
    {
        return $d['_geo']['lat'] ?? $d['latitude'] ?? null ? (float) ($d['_geo']['lat'] ?? $d['latitude']) : null;
    }

    private function lng(array $d): ?float
    {
        return $d['_geo']['lng'] ?? $d['longitude'] ?? null ? (float) ($d['_geo']['lng'] ?? $d['longitude']) : null;
    }

    private function score(array $d): ?float
    {
        return isset($d['_rankingScore']) ? (float) $d['_rankingScore'] : null;
    }

    private function firstNonEmpty(string ...$vals): string
    {
        foreach ($vals as $v) {
            if ($v !== '') {
                return $v;
            }
        }

        return '';
    }

    private function nullIfEmpty(?string $v): ?string
    {
        $v = $v ?? '';

        return $v === '' ? null : $v;
    }
}
