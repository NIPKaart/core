import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compile = (path) =>
    ts.transpileModule(readFileSync(new URL(`../../resources/js/${path}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
const utils = { exports: {} };
vm.runInNewContext(compile('components/map/parking-detail/utils.tsx'), { exports: utils.exports, require: () => ({}) });
const context = { exports: {}, require: () => utils.exports };
vm.runInNewContext(compile('lib/garage-overview.ts'), context);
const { garageLiveState, filterMunicipalities, sortGarages, overviewSummary } = context.exports;

const garage = (overrides = {}) => ({
    id: 'G1',
    name: 'Centrum',
    type: 'garage',
    latitude: 52.37,
    longitude: 4.9,
    availability: 'current',
    occupancy_status: 'counting',
    observed_at: '2026-09-28T10:00:00Z',
    capacity: 400,
    free_space: 37,
    ...overrides,
});
const state = (overrides) => ({ ...garageLiveState(garage(overrides)) });

test('a current count shows general free spaces with the occupancy bar', () => {
    assert.deepEqual(state({}), { status: 'free', tone: 'green', free: 37, total: 400, percent: 91, bar: 'red' });
});

test('more free than capacity keeps the count without a bar', () => {
    assert.deepEqual(state({ free_space: 535, capacity: 410 }), { status: 'free', tone: 'green', free: 535, total: 410, percent: null, bar: null });
});

test('full, closed and missing data are words, never a zero count', () => {
    assert.equal(state({ free_space: 0 }).status, 'full');
    assert.equal(state({ occupancy_status: 'full', free_space: null }).status, 'full');
    assert.deepEqual(state({ availability: 'closed', free_space: null }), {
        status: 'closed',
        tone: 'zinc',
        free: null,
        total: null,
        percent: null,
        bar: null,
    });
    assert.equal(state({ availability: 'stale', free_space: null }).tone, 'zinc');
    assert.equal(state({ availability: 'unavailable', free_space: null }).tone, 'red');
    assert.equal(state({ availability: 'unknown', free_space: null, observed_at: null }).status, 'unknown');
});

test('a status without a count stays a status', () => {
    assert.equal(state({ occupancy_status: 'open', free_space: null }).status, 'open');
    assert.equal(state({ occupancy_status: 'open', free_space: null }).free, null);
});

test('filtering keeps a matching municipality whole and otherwise only matching garages', () => {
    const municipalities = [
        { name: 'Amsterdam', garages: [garage({ id: 'A', name: 'Centrum' }), garage({ id: 'B', name: 'Zuidas' })] },
        { name: 'Utrecht', garages: [garage({ id: 'C', name: 'Jaarbeurs' }), garage({ id: 'D', name: 'Centrum Oost' })] },
    ];
    assert.deepEqual(JSON.parse(JSON.stringify(filterMunicipalities(municipalities, '  '))), municipalities);
    assert.deepEqual(
        filterMunicipalities(municipalities, 'amster').map((m) => m.garages.length),
        [2],
    );
    assert.deepEqual(
        filterMunicipalities(municipalities, 'CENTRUM').map((m) => [m.name, m.garages.map((g) => g.id)]),
        [
            ['Amsterdam', ['A']],
            ['Utrecht', ['D']],
        ],
    );
    assert.deepEqual(filterMunicipalities(municipalities, 'Rotterdam'), []);
});

test('the type filter applies before the search and drops emptied municipalities', () => {
    const municipalities = [
        { name: 'Amsterdam', garages: [garage({ id: 'A', name: 'Centrum' }), garage({ id: 'B', name: 'P+R Noord', type: 'parkandride' })] },
        { name: 'Utrecht', garages: [garage({ id: 'C', name: 'Jaarbeurs' })] },
    ];
    assert.deepEqual(
        filterMunicipalities(municipalities, '', 'parkandride').map((m) => [m.name, m.garages.map((g) => g.id)]),
        [['Amsterdam', ['B']]],
    );
    assert.deepEqual(
        filterMunicipalities(municipalities, 'amsterdam', 'garage').map((m) => m.garages.map((g) => g.id)),
        [['A']],
    );
});

test('most free sorts current counts first and keeps unknown after them in name order', () => {
    const garages = [
        garage({ id: 'closed', availability: 'closed', free_space: null }),
        garage({ id: 'few', free_space: 10 }),
        garage({ id: 'status-only', occupancy_status: 'open', free_space: null }),
        garage({ id: 'many', free_space: 300 }),
        garage({ id: 'stale', availability: 'stale', free_space: null }),
    ];
    assert.equal(sortGarages(garages, 'name'), garages);
    assert.deepEqual(
        sortGarages(garages, 'free').map((g) => g.id),
        ['many', 'few', 'closed', 'status-only', 'stale'],
    );
});

test('the summary counts types and live states and finds the newest measurement', () => {
    const summary = overviewSummary([
        {
            name: 'Amsterdam',
            garages: [
                garage({ observed_at: '2026-09-28T10:00:00Z' }),
                garage({ type: 'parkandride', availability: 'closed', observed_at: '2026-09-28T10:05:00Z' }),
                garage({ availability: 'stale', observed_at: '2026-09-28T09:00:00Z' }),
                garage({ availability: 'unknown', observed_at: null }),
            ],
        },
    ]);
    assert.deepEqual(
        { ...summary },
        { total: 4, garages: 3, parkandride: 1, current: 1, closed: 1, withoutLiveData: 2, latestObservedAt: '2026-09-28T10:05:00Z' },
    );
    assert.equal(overviewSummary([]).latestObservedAt, null);
});
