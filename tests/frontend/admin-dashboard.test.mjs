import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/dashboard.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const overview = {
    destinations: [
        { id: 1, label: 'Werk', destination: { key: 'd:1', label: 'Stationsplein 1', sub: null, type: 'address', latitude: 52.09, longitude: 5.11 } },
        { id: 2, label: 'Mama', destination: { key: 'd:2', label: 'Dorpsstraat 14', sub: null, type: 'address', latitude: 52.03, longitude: 5.17 } },
    ],
    destination_id: 1,
    nearby: {
        total: 8,
        more: false,
        items: [
            {
                key: 'community:7',
                source: 'community',
                title: 'Jaarbeursplein 3',
                distance_metres: 120,
                parking_time: 180,
                free_space: null,
                map_url: '/map?place=community:7',
            },
        ],
    },
    garage: null,
    pending: null,
    published: 0,
    favorites: { total: 0, items: [] },
    rules: [],
    history: [],
};

function render(pageProps) {
    const route = (name) =>
        Object.assign((options) => ({ url: `/${name}${options?.query ? '?' + new URLSearchParams(options.query) : ''}` }), {
            url: (options) => `/${name}${options?.query ? '?' + new URLSearchParams(options.query) : ''}`,
        });
    const context = {
        exports: {},
        Intl,
        require: (name) => {
            if (name === '@/components/confirm-dialog') return { ConfirmDialog: () => null };
            if (name === '@/components/frontend/garage-table') return { useMeasuredTime: () => () => '14:32' };
            if (name === '@/components/map/destinations') return { default: () => React.createElement('div', { 'data-destinations': true }) };
            if (name === '@/components/map/favorites') return { default: () => React.createElement('div', { 'data-favorites': true }) };
            if (name === '@/components/map/parking-detail/navigation-handoff') return { navigationUrl: () => 'https://maps.example/route' };
            if (name === '@/components/map/parking-detail/parts') return { Chip: ({ children }) => React.createElement('span', null, children) };
            if (name === '@/components/map/parking-detail/utils')
                return { formatDistance: (metres) => `${metres} m`, formatShortDate: (value) => value.slice(0, 10) };
            if (name === '@/components/search/search-store') return { openSearch: () => {}, setSearchQuery: () => {}, useSearchQuery: () => '' };
            if (name === '@/components/ui/button')
                return { Button: ({ children, asChild, disabled }) => (asChild ? children : React.createElement('button', { disabled }, children)) };
            if (name === '@/components/ui/input') return { Input: (props) => React.createElement('input', props) };
            if (name === '@/components/ui/table') return Object.fromEntries(Object.entries({Table: 'table', TableBody: 'tbody', TableCell: 'td', TableHead: 'th', TableHeader: 'thead', TableRow: 'tr'}).map(([component, tag]) => [component, (props) => React.createElement(tag, props)]));
            if (name === '@/components/ui/progress') return { Progress: () => React.createElement('div', { role: 'progressbar' }) };
            if (name === '@/layouts/app-layout') return { default: ({ children }) => React.createElement('main', null, children) };
            if (name === '@/lib/garage-occupancy') return {};
            if (name === '@/lib/garage-overview')
                return {
                    garageLiveState: (garage) => ({
                        status: 'free',
                        tone: 'green',
                        free: garage.free_space,
                        total: garage.capacity,
                        percent: 76,
                        bar: 'green',
                    }),
                };
            if (name === '@/lib/pin-svg') return { pinSvg: () => '<svg></svg>' };
            if (name === '@/lib/saved-places') return { destinationMapUrl: (destination) => `/map?destination=${destination.key}` };
            if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
            if (name === '@/routes') return { dashboard: route('dashboard'), garages: route('garages'), locationMap: route('map') };
            if (name === '@/routes/app') return { default: { moderation: { index: route('moderation') } } };
            if (name === '@/routes/app/parking-rules') return { default: { index: route('parking-rules') } };
            if (name === '@/routes/location-map') return { default: { add: route('add') } };
            if (name === '@/routes/profile/parking-spaces') return { index: route('profile/parking-spaces'), destroy: route('withdraw') };
            if (name === '@/routes/profile/destinations') return { index: route('profile/destinations') };
            if (name === '@/routes/profile/favorites') return { index: route('profile/favorites') };
            if (name.startsWith('@/actions/'))
                return { index: route('imports'), show: Object.assign((id) => ({ url: `/imports/${id}` }), { url: (id) => `/imports/${id}` }) };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key, i18n: { language: 'nl' } }) };
            if (name === '@inertiajs/react')
                return {
                    Head: () => null,
                    Deferred: ({ children }) => children,
                    router: {},
                    usePage: () => ({ props: { auth: { user: { name: 'Klaas Schoute' } } } }),
                    Link: ({ children, href, className, preserveScroll: _preserveScroll, preserveState: _preserveState, only: _only, ...props }) =>
                        React.createElement('a', { href: typeof href === 'string' ? href : href.url, className, ...props }, children),
                };
            return require(name);
        },
    };
    vm.runInNewContext(source, context);
    return renderToStaticMarkup(
        React.createElement(context.exports.default, {
            section: null,
            view: 'personal',
            hasTodo: false,
            overview,
            ...pageProps,
            contributions: pageProps.contributions ? {
                total: pageProps.contributions.data.length, last_page: 2, from: 1, to: pageProps.contributions.data.length,
                counts: { all: pageProps.contributions.data.length }, filters: { search: '', status: null },
                ...pageProps.contributions,
            } : null,
        }),
    );
}

const todo = {
    moderation: { total: 8, high: 1, types: { submission: 7, report: 1 }, oldest: '2026-10-01T09:00:00+00:00' },
    next: {
        key: 'report:community:7',
        type: 'report',
        priority: 'high',
        street: 'Biltstraat 88',
        municipality: 'Utrecht',
        contributor: null,
        reports: 3,
        waiting_since: '2026-10-01T09:00:00+00:00',
        url: '/admin/moderation/reports/community/7',
    },
    decisions: { total: 4, approved: 3, rejected: 1, reports: 0 },
    sources: { total: 0, items: [] },
    rules: { total: 0, items: [] },
    attention: false,
};

test('people without moderation work start from their destinations with the parking nearby and no workplace', () => {
    const html = render({});
    assert.match(html, /hero\.title/);
    assert.match(html, /Werk/);
    assert.match(html, /href="\/dashboard\?view=personal&amp;destination=2"/);
    assert.match(html, /Jaarbeursplein 3/);
    assert.match(html, /href="\/map\?place=community:7"/);
    assert.match(html, /href="\/map\?destination=d:1"/);
    assert.doesNotMatch(html, /href="\/(moderation|imports|parking-rules)/);
    assert.doesNotMatch(html, /view\.label/);
});

test('every tile keeps its place with an empty state that offers the next step when there is no data yet', () => {
    const html = render({});
    assert.match(html, /garage\.empty_title/);
    assert.match(html, /href="\/garages"/);
    assert.match(html, /pending\.empty_title/);
    assert.match(html, /rules\.empty/);
    assert.match(html, /favorites\.empty/);
    assert.match(html, /href="\/map"/);
    assert.match(html, /history\.empty/);
    assert.match(html, /impact\.none/);
    assert.match(html, /href="\/add"/);
});

test('a saved garage, a waiting submission and official rules each get their own tile with direct actions', () => {
    const html = render({
        overview: {
            ...overview,
            garage: {
                id: 'OFST_1',
                name: 'P+R Science Park',
                type: 'parkandride',
                latitude: 52.08,
                longitude: 5.17,
                availability: 'current',
                occupancy_status: 'counting',
                observed_at: '2026-10-15T14:32:00+00:00',
                capacity: 600,
                free_space: 142,
                municipality: 'Utrecht',
                map_url: '/map?place=offstreet:OFST_1',
            },
            pending: {
                label: 'Lange Nieuwstraat 42, Utrecht',
                submitted_at: '2026-10-12T09:00:00+00:00',
                edit_url: '/map/add/9/edit',
                withdraw_id: '9',
            },
            published: 12,
            rules: [{ id: 3, name: 'Utrecht', nationwide: false, url: 'https://utrecht.example/regels' }],
        },
    });
    assert.match(html, /P\+R Science Park/);
    assert.match(html, /142/);
    assert.match(html, /href="https:\/\/maps\.example\/route"/);
    assert.match(html, /Lange Nieuwstraat 42/);
    assert.match(html, /href="\/map\/add\/9\/edit"/);
    assert.match(html, /aria-current="step"/);
    assert.match(html, /href="https:\/\/utrecht\.example\/regels"[^>]*target="_blank"/);
    assert.match(html, /impact\.text/);
});

test('moderators land on the workplace with the next item opening its review and a way back to personal', () => {
    const html = render({ hasTodo: true, view: 'work', todo });
    assert.match(html, /work\.title/);
    assert.match(html, /Biltstraat 88/);
    assert.match(html, /href="\/admin\/moderation\/reports\/community\/7"/);
    assert.match(html, /href="\/moderation"/);
    assert.match(html, /href="\/dashboard\?view=personal"/);
    assert.match(html, /work\.decisions\.split/);
    assert.doesNotMatch(html, /hero\.title|work\.attention\.eyebrow/);
});

test('administrators keep the attention tile with a reassuring empty state when nothing needs attention', () => {
    const html = render({ hasTodo: true, view: 'work', todo: { ...todo, attention: true } });
    assert.match(html, /work\.attention\.eyebrow/);
    assert.match(html, /work\.attention\.none/);
});

test('administrators see data sources and broken rule links that need attention, each with its own action', () => {
    const html = render({
        hasTodo: true,
        view: 'work',
        todo: {
            ...todo,
            sources: {
                total: 1,
                items: [{ id: 3, name: 'Gemeente Utrecht', status: 'awaiting_review', import_id: 12, since: '2026-10-04T09:00:00+00:00' }],
            },
            rules: { total: 2, items: [{ id: 5, name: 'Houten', failing_since: '2026-10-11T03:00:00+00:00' }] },
            attention: true,
        },
    });
    assert.match(html, /Gemeente Utrecht/);
    assert.match(html, /href="\/imports\/12"/);
    assert.match(html, /Houten/);
    assert.match(html, /work\.attention\.rule_broken/);
    assert.match(html, /href="\/parking-rules"/);
    assert.match(html, /work\.attention\.more_rules/);
});

test('the contributions section shows current statuses reasons and map or edit actions', () => {
    const html = render({
        section: 'contributions',
        contributions: {
            data: [
                {
                    key: 'submission:1',
                    kind: 'submission',
                    label: 'Museumstraat',
                    at: '2026-10-01T09:00:00Z',
                    status: 'pending',
                    withdraw_id: '1',
                    reason: null,
                    url: '/map/add/1/edit',
                    action: 'edit',
                },
                {
                    key: 'improvement:2',
                    kind: 'improvement',
                    label: 'Kerkstraat',
                    at: '2026-10-02T09:00:00Z',
                    status: 'rejected',
                    withdraw_id: null,
                    reason: '<rejection>',
                    url: '/map?place=community:2',
                    action: 'map',
                },
            ],
            current_page: 1,
            prev_page_url: null,
            next_page_url: '/profile/parking-spaces?contributions_page=2',
        },
    });
    assert.match(html, /sections\.back/);
    assert.match(html, /Museumstraat/);
    assert.match(html, /contributions\.withdraw\.label/);
    assert.match(html, /href="\/map\/add\/1\/edit"/);
    assert.match(html, /&lt;rejection&gt;/);
    assert.match(html, /contributions_page=2/);
    assert.match(html, /disabled/);
    assert.doesNotMatch(html, /hero\.title/);
});

test('the destinations and favorites sections keep their full management lists', () => {
    assert.match(render({ section: 'destinations' }), /data-destinations/);
    assert.match(render({ section: 'favorites' }), /data-favorites/);
});

test('personal sections use the available workspace width for their headings and content', () => {
    for (const section of ['destinations', 'favorites', 'contributions']) {
        const html = render({ section, contributions: { data: [], current_page: 1, prev_page_url: null, next_page_url: null } });
        const classes = html.match(/<section aria-labelledby="dashboard-section" class="([^"]+)"/)[1].split(' ');

        assert.ok(classes.includes('w-full'), section);
        assert.equal(classes.some((value) => value.startsWith('max-w-')), false, section);
    }
});


test('contributions expose a searchable status-filtered table and bounded pagination for a hundred entries', () => {
    const html = render({ section: 'contributions', contributions: {
        data: [{ key: 'submission:1', kind: 'submission', label: '<Stationsplein>', at: '2026-10-29T09:00:00Z', status: 'approved', reason: null, url: '/map?place=community:1', action: 'map', withdraw_id: null }],
        current_page: 5, last_page: 10, total: 89, from: 41, to: 50,
        counts: { all: 100, approved: 89, pending: 8, rejected: 3 }, filters: { search: 'Stations', status: 'approved' },
        prev_page_url: '/profile/parking-spaces?contributions_page=4', next_page_url: '/profile/parking-spaces?contributions_page=6',
    }});
    assert.match(html, /<table/);
    assert.match(html, /role="search"/);
    assert.match(html, /value="Stations"/);
    assert.match(html, /&lt;Stationsplein&gt;/);
    assert.match(html, /aria-current="page"[^>]*>5</);
    assert.match(html, /contributions_search=Stations&amp;contributions_status=approved&amp;contributions_page=10/);
    assert.match(html, /contributions\.status\.pending/);
    assert.doesNotMatch(html, /contributions_page=8/);
});

test('an empty contribution search keeps the controls available and offers to reset the filters', () => {
    const html = render({ section: 'contributions', contributions: {
        data: [], current_page: 1, last_page: 1, total: 0, from: null, to: null, prev_page_url: null, next_page_url: null,
        counts: { all: 0 }, filters: { search: 'Missing', status: null },
    }});
    assert.match(html, /contributions\.no_results/);
    assert.match(html, /contributions\.reset/);
    assert.match(html, /role="search"/);
    assert.doesNotMatch(html, /aria-label="contributions.pagination"/);
});
