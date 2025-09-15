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

        [$place, $free, $postcode] = $this->parseQuery($q);

        $cityGroup = $place ? $this->equalsGroup('city', $this->caseVariants($place)) : null;
        $municipalityGroup = $place ? $this->equalsGroup('municipality_name', $this->caseVariants($place)) : null;
        $postcodeGroup = $postcode ? $this->equalsGroup('postcode', $this->postcodeVariants($postcode)) : null;

        $indices = [
            'parking_spaces' => [
                'type' => 'community',
                'route' => route('location-map'),
                'placeField' => 'city',
                'supportsPostcode' => true,
                'label' => fn (array $d) => $this->firstNonEmpty(
                    trim((string) ($d['street'] ?? '')),
                    trim((string) ($d['city'] ?? '')),
                    'Community spot'
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
                'placeField' => 'municipality_name',
                'supportsPostcode' => false,
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
                'placeField' => 'municipality_name',
                'supportsPostcode' => true,
                'label' => fn (array $d) => $this->firstNonEmpty(
                    trim(implode(' ', array_filter([
                        (string) ($d['street'] ?? ''),
                        isset($d['number']) ? (string) $d['number'] : '',
                    ]))),
                    'Municipal spot'
                ),
                'sub' => fn (array $d) => $this->nullIfEmpty(
                    $this->firstNonEmpty(
                        trim((string) ($d['municipality_name'] ?? '')),
                        trim((string) ($d['province_name'] ?? ''))
                    )
                ),
            ],
        ];

        $queries = [];
        foreach ($indices as $uid => $conf) {
            $andFilter = [];

            if ($conf['placeField'] === 'city' && $cityGroup) {
                $andFilter[] = $cityGroup;
            } elseif ($conf['placeField'] === 'municipality_name' && $municipalityGroup) {
                $andFilter[] = $municipalityGroup;
            }

            if (! empty($conf['supportsPostcode']) && $postcodeGroup) {
                $andFilter[] = $postcodeGroup;
            }

            $sq = (new SearchQuery)
                ->setIndexUid($uid)
                ->setQuery($free !== '' ? $free : $q)
                ->setLimit($limit);

            if (! empty($andFilter)) {
                $sq->setFilter($andFilter);
            }

            $queries[] = $sq;
        }

        $resp = $this->meili->multiSearch($queries);
        $hits = [];
        $total = 0;

        foreach ($resp['results'] as $r) {
            $index = (string) ($r['indexUid'] ?? 'unknown');
            $total += (int) ($r['estimatedTotalHits'] ?? 0);
            if (! isset($indices[$index])) {
                continue;
            }

            $c = $indices[$index];
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

        usort(
            $hits,
            static fn (array $a, array $b) => (($b['score'] ?? 0) <=> ($a['score'] ?? 0))
                ?: strcmp((string) $a['label'], (string) $b['label'])
        );

        return response()->json([
            'hits' => array_slice($hits, 0, $limit * 2),
            'estimatedTotalHits' => $total,
        ]);
    }

    /**
     * Parse:
     * - Prefix: "municipal: Amsterdam Keizersgracht 10"
     * - Comma:  "Amsterdam, Keizersgracht 10"
     * - NL-postcode (1234 AB) -> as filter + from free text.
     *
     * @return array{0:?string,1:string,2:?string} [place, free, postcode]
     */
    private function parseQuery(string $q): array
    {
        $q = trim(preg_replace('/\s+/', ' ', $q));
        $postcode = $this->extractPostcode($q);
        if ($postcode !== null) {
            $q = trim(str_ireplace($postcode, '', $q));
        }

        if (preg_match('/^(?:municipal|in|city|municipality)\s*:\s*(.+?)(?:\s+|,)(.*)$/iu', $q, $m)) {
            $place = trim((string) ($m[1] ?? ''));
            $free = trim((string) ($m[2] ?? ''));

            return [$place !== '' ? $place : null, $free, $postcode];
        }

        if (str_contains($q, ',')) {
            [$left, $right] = array_map('trim', explode(',', $q, 2));
            $place = $left !== '' ? $left : null;

            return [$place, $right, $postcode];
        }

        return [null, $q, $postcode];
    }

    /** NL-postcode: 1000 AA */
    private function extractPostcode(string $q): ?string
    {
        if (preg_match('/\b([1-9][0-9]{3})\s?([A-Z]{2})\b/u', strtoupper($q), $m)) {
            return sprintf('%s %s', $m[1], $m[2]);
        }

        return null;
    }

    /** Equals-group for Meilisearch (OR): field = "val1" OR field = "val2" ... */
    private function equalsGroup(string $field, array $values): array
    {
        $vals = array_values(array_unique(array_filter(array_map('strval', $values), fn ($v) => $v !== '')));

        return array_map(fn ($v) => sprintf('%s = "%s"', $field, $this->escapeFilter($v)), $vals);
    }

    /** Case-variants: "den bosch", "Den Bosch", "DEN BOSCH" */
    private function caseVariants(string $s): array
    {
        $s = trim($s);
        if ($s === '') {
            return [];
        }

        return array_values(array_unique([
            $s,
            mb_strtolower($s, 'UTF-8'),
            mb_strtoupper($s, 'UTF-8'),
            $this->toTitle($s),
        ]));
    }

    /** "den bosch" → "Den Bosch" */
    private function toTitle(string $s): string
    {
        $parts = preg_split('/(\s+|-|’|\')/u', $s, -1, PREG_SPLIT_DELIM_CAPTURE);
        foreach ($parts as $i => $p) {
            if ($i % 2 === 0) {
                $parts[$i] = mb_convert_case($p, MB_CASE_TITLE, 'UTF-8');
            }
        }

        return implode('', $parts);
    }

    /** Postcode variants: "1234 AB" én "1234AB" */
    private function postcodeVariants(string $pc): array
    {
        $pc = strtoupper(trim($pc));
        $withSpace = preg_replace('/\s+/', ' ', $pc);
        $noSpace = preg_replace('/\s+/', '', $pc);

        return array_values(array_unique([$withSpace, $noSpace]));
    }

    private function escapeFilter(string $v): string
    {
        return str_replace('"', '\"', $v);
    }

    private function lat(array $d): ?float
    {
        $v = $d['_geo']['lat'] ?? $d['latitude'] ?? null;

        return is_numeric($v) ? (float) $v : null;
    }

    private function lng(array $d): ?float
    {
        $v = $d['_geo']['lng'] ?? $d['longitude'] ?? null;

        return is_numeric($v) ? (float) $v : null;
    }

    private function score(array $d): ?float
    {
        $v = $d['_rankingScore'] ?? null;

        return is_numeric($v) ? (float) $v : null;
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
