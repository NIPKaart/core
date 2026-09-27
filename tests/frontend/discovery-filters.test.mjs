import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/lib/discovery-filters.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(source, context);
const { readDiscoveryFilters, discoveryFilterUrl, defaultDiscoveryFilters } = context.exports;

test('shared filters round trip without losing destination, other query state or map position', () => {
    const url = new URL('https://example.test/map?destination=Station&lat=52&lng=5&other=keep#14/52/5');
    const filters = { source: 'municipal', radius: 500, sort: 'distance' };
    const shared = new URL(discoveryFilterUrl(url, filters), url);
    assert.deepEqual({ ...readDiscoveryFilters(shared.searchParams) }, filters);
    assert.equal(shared.searchParams.get('destination'), 'Station');
    assert.equal(shared.searchParams.get('other'), 'keep');
    assert.equal(shared.hash, '#14/52/5');
    const reset = new URL(discoveryFilterUrl(shared, defaultDiscoveryFilters), url);
    assert.deepEqual({ ...readDiscoveryFilters(reset.searchParams) }, { source: 'all', radius: 1000, sort: 'balanced' });
});

test('invalid or unsupported shared filters fall back to explicit defaults', () => {
    for (const query of ['', 'source=unknown&radius=-1&sort=availability', 'radius=Infinity', 'radius=1.5']) {
        assert.deepEqual({ ...readDiscoveryFilters(new URLSearchParams(query)) }, { source: 'all', radius: 1000, sort: 'balanced' });
    }
});

test('choosing a new destination preserves filters and removes the previous map position and bounds', () => {
    const url = new URL('https://example.test/map?destination=Old&lat=51&lng=4&source=municipal&radius=500&sort=distance&view=list&south=50&north=52&west=3&east=5#14/51/4');
    const next = new URL(context.exports.discoveryDestinationUrl(url, { label: 'Amstel, Amsterdam', latitude: 52.36, longitude: 4.9 }), url);
    assert.equal(next.searchParams.get('destination'), 'Amstel, Amsterdam');
    assert.equal(next.searchParams.get('lat'), '52.36');
    assert.equal(next.searchParams.has('view'), false);
    assert.equal(next.hash, '');
    assert.equal(next.searchParams.has('south'), false);
    assert.equal(next.searchParams.has('east'), false);
    assert.deepEqual({ ...readDiscoveryFilters(next.searchParams) }, { source: 'municipal', radius: 500, sort: 'distance' });
});

test('streets, areas and legacy destinations remain approximate while specific destinations retain their type in shared links', () => {
    for (const type of ['street', 'city', 'district', 'residential', 'destination', 'unknown']) {
        assert.equal(context.exports.isApproximateDestination({ type }), true);
    }
    for (const type of ['address', 'building', 'amenity', 'community', 'municipal', 'offstreet']) {
        assert.equal(context.exports.isApproximateDestination({ type }), false);
    }
    for (const type of ['street', 'address']) {
        const url = new URL('https://example.test/map');
        const shared = new URL(context.exports.discoveryDestinationUrl(url, { label: 'Test', type, latitude: 52, longitude: 5 }), url);
        const restored = { type: shared.searchParams.get('destination_type') ?? 'destination' };
        assert.equal(restored.type, type);
        assert.equal(context.exports.isApproximateDestination(restored), type === 'street');
    }
});

test('clearing the destination removes all destination state while preserving filters and the current map view', () => {
    const url = new URL('https://example.test/map?destination=Amstel&destination_type=street&lat=52&lng=5&south=51&north=53&west=4&east=6&source=municipal&radius=500&sort=distance#17/52/5');
    const cleared = new URL(context.exports.clearDiscoveryDestinationUrl(url), url);
    assert.equal(cleared.search, '?source=municipal&radius=500&sort=distance');
    assert.equal(cleared.hash, '#17/52/5');
});
