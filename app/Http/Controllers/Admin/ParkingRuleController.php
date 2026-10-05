<?php

namespace App\Http\Controllers\Admin;

use App\Enums\RuleLinkStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\App\StoreParkingRuleRequest;
use App\Http\Requests\App\UpdateParkingRuleRequest;
use App\Models\Country;
use App\Models\Municipality;
use App\Models\ParkingRule;
use App\Services\ParkingRuleLinkChecker;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ParkingRuleController extends Controller
{
    /** What admins see about whether a source's link still opens. */
    private const array HEALTH = ['link_status', 'link_http_status', 'link_error', 'link_final_url', 'link_checked_at', 'link_failing_since'];

    /**
     * The country-wide source of each country, and the municipalities with a source of their own.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', ParkingRule::class);

        $search = trim((string) $request->input('search'));
        $countryId = $request->integer('country') ?: null;

        $municipalities = Municipality::query()->toBase()->selectRaw('country_id, count(*) as total')->groupBy('country_id')->pluck('total', 'country_id');
        $ownSources = ParkingRule::query()->whereNotNull('municipality_id')->toBase()->selectRaw('country_id, count(*) as total')->groupBy('country_id')->pluck('total', 'country_id');
        $national = ParkingRule::query()->whereNull('municipality_id')->get()->keyBy('country_id');

        $countries = Country::query()
            ->where(fn (Builder $query) => $query->whereIn('id', $municipalities->keys())->orWhereIn('id', $national->keys()))
            ->orderBy('name')
            ->get(['id', 'name', 'code'])
            ->map(fn (Country $country) => [
                'id' => $country->id,
                'name' => $country->name,
                'code' => $country->code,
                'municipalities' => (int) ($municipalities[$country->id] ?? 0),
                'own_sources' => (int) ($ownSources[$country->id] ?? 0),
                'rule' => $national->get($country->id)?->only(['id', 'url', 'updated_at', ...self::HEALTH]),
            ]);

        $rules = ParkingRule::query()
            ->whereNotNull('municipality_id')
            ->with(['municipality:id,name,province_id', 'municipality.province:id,name', 'country:id,name'])
            ->when($countryId !== null, fn (Builder $query) => $query->where('country_id', $countryId))
            ->when($search !== '', fn (Builder $query) => $query->whereHas('municipality', fn (Builder $municipality) => $municipality->where('name', 'ilike', '%'.addcslashes($search, '%_\\').'%')))
            ->orderBy(Municipality::select('name')->whereColumn('municipalities.id', 'parking_rules.municipality_id'))
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('backend/parking-rules/index', [
            'countries' => $countries,
            'rules' => $rules,
            'filters' => ['search' => $search, 'country' => $countryId],
            'brokenLinks' => ParkingRule::query()->where('link_status', RuleLinkStatus::BROKEN)->count(),
            'availableMunicipalities' => Inertia::defer(fn () => Municipality::query()
                ->whereDoesntHave('parkingRules')
                ->with('province:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'country_id', 'province_id'])
                ->map(fn (Municipality $municipality) => [
                    'id' => $municipality->id,
                    'name' => $municipality->name,
                    'country_id' => $municipality->country_id,
                    'province' => $municipality->province?->name,
                ])),
        ]);
    }

    /**
     * Add the source for a country or for one municipality.
     */
    public function store(StoreParkingRuleRequest $request): RedirectResponse
    {
        Gate::authorize('create', ParkingRule::class);

        ParkingRule::create($request->validated());
        Inertia::flash('success', __('parking_rules.flash.created'));

        return redirect()->route('app.parking-rules.index');
    }

    /**
     * Point a source to another page; what it applies to stays the same.
     */
    public function update(UpdateParkingRuleRequest $request, ParkingRule $parkingRule): RedirectResponse
    {
        Gate::authorize('update', $parkingRule);

        $parkingRule->update($request->safe()->only('url'));
        Inertia::flash('success', __('parking_rules.flash.updated'));

        return redirect()->route('app.parking-rules.index');
    }

    /**
     * Check one source's link now, for example right after fixing it.
     */
    public function check(ParkingRule $parkingRule, ParkingRuleLinkChecker $checker): RedirectResponse
    {
        Gate::authorize('update', $parkingRule);

        $status = $checker->check($parkingRule);
        Inertia::flash($status === RuleLinkStatus::BROKEN ? 'error' : 'success', __("parking_rules.flash.checked.{$status->value}"));

        return redirect()->route('app.parking-rules.index');
    }

    /**
     * Remove a source; visitors then see the country's source, or that no source is known.
     */
    public function destroy(ParkingRule $parkingRule): RedirectResponse
    {
        Gate::authorize('delete', $parkingRule);

        $parkingRule->delete();
        Inertia::flash('success', __('parking_rules.flash.deleted'));

        return redirect()->route('app.parking-rules.index');
    }
}
