import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/lib/place-link.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {}, URLSearchParams };
vm.runInNewContext(source, context);
const { placeLinkPath, readPlaceLink, withoutPlaceLink } = context.exports;

test('a place link survives the trip through login and reopens the same place', () => {
    const path = placeLinkPath({ source: 'municipal', id: 'NL:0363:abc', latitude: 52.358287, longitude: 4.7866371 });
    assert.equal(path, '/map?place=municipal%3ANL%3A0363%3Aabc&at=52.35829%2C4.78664');

    const place = readPlaceLink(new URL(path, 'https://example.test').searchParams);
    assert.deepEqual(
        { ...place },
        {
            key: 'municipal:NL:0363:abc',
            id: 'NL:0363:abc',
            source: 'municipal',
            latitude: 52.35829,
            longitude: 4.78664,
            title: '',
            distance_metres: null,
        },
    );
});

test('malformed place links are ignored', () => {
    for (const query of [
        '',
        'place=garage:1&at=52,4',
        'place=community:&at=52,4',
        'place=community:abc',
        'place=community:abc&at=91,4',
        'place=community:abc&at=x,y',
    ]) {
        assert.equal(readPlaceLink(new URLSearchParams(query)), null, query);
    }
});

test('after opening, the link gives way to the usual map position and keeps other state', () => {
    const url = new URL('https://example.test/map?place=community%3Aabc&at=52.1%2C4.3&source=municipal');
    const place = readPlaceLink(url.searchParams);
    assert.equal(withoutPlaceLink(url, place), '/map?source=municipal#19/52.10000/4.30000');
});
