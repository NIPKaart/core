<?php

namespace App\Http\Controllers\Frontend;

use App\Enums\SupportedLocale;
use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\Province;
use App\Services\AreaPages;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class AreaController extends Controller
{
    public function __construct(private AreaPages $areas) {}

    /**
     * Frontend - The area overview starts at the country with the most public parking.
     */
    public function index(): RedirectResponse
    {
        $country = $this->areas->countries()->first() ?? abort(404);

        return redirect()->to($this->areas->countryUrl($country));
    }

    /**
     * Frontend - Public parking in one country, with its regions and municipalities.
     */
    public function country(Request $request, string $country): Response
    {
        $model = $this->findCountry($country);

        return $this->render($request, 'frontend/areas/country', $this->areas->country($model), route('areas.country', strtolower($model->code)));
    }

    /**
     * Frontend - Public parking in one region (province) of a country.
     */
    public function region(Request $request, string $country, string $region): Response
    {
        $model = Province::query()->with('country')->where('country_id', $this->findCountry($country)->id)->where('slug', $region)->firstOrFail();

        return $this->render($request, 'frontend/areas/region', $this->areas->region($model), route('areas.region', [$country, $model->slug]));
    }

    /**
     * Frontend - Public parking in one municipality. Without public parking the page stays reachable, but is not indexed.
     */
    public function municipality(Request $request, string $country, string $municipality): Response
    {
        $model = Municipality::query()->with(['country', 'province'])->where('country_id', $this->findCountry($country)->id)->where('slug', $municipality)->firstOrFail();

        return $this->render($request, 'frontend/areas/municipality', $this->areas->municipality($model), $this->areas->municipalityUrl($model));
    }

    /**
     * Countries are addressed by their lowercase ISO code; the routes accept no other spelling.
     */
    private function findCountry(string $code): Country
    {
        return Country::query()->where('code', strtoupper($code))->firstOrFail();
    }

    /**
     * Server-rendered title, description, canonical and robots, so crawlers read them without running the page script.
     *
     * @param  array<string, mixed>  $page
     */
    private function render(Request $request, string $component, array $page, string $canonical): Response
    {
        $locale = SupportedLocale::parse(app()->getLocale()) ?? SupportedLocale::EN;
        $meta = File::json(resource_path("locales/frontend/{$locale->value}/areas.json"))['meta'];
        $replace = ['{{name}}' => $page['name']];
        $seo = [
            'title' => strtr($meta['title'], $replace).' - '.config('app.name'),
            'description' => strtr($meta['description'][$page['level']], $replace),
            'canonical' => $canonical,
            'robots' => $page['indexable'] ? null : 'noindex',
        ];

        return Inertia::render($component, [...$page, 'canonical' => $canonical])
            ->withViewData(['pageMeta' => $seo])
            ->toResponse($request);
    }
}
