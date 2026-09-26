import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const translations = JSON.parse(readFileSync(new URL('../../resources/locales/global/en/search.json', import.meta.url), 'utf8'));
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/search/search-overlay.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function mount(results, response = { result: { label: 'Amsterdam', latitude: 52.37, longitude: 4.9 } }) {
    let state = 0;
    const requests = [];
    const location = { href: '' };
    const primitive = ({ children }) => React.createElement('div', null, children);
    const context = { exports: {}, setTimeout, window: { location }, fetch: async (url) => { requests.push(url); return { ok: true, json: async () => response }; }, require: (name) => {
        if (name === 'react') return { ...React, useState: (value) => [state++ === 0 ? results : value, () => {}], useEffect: () => {}, useRef: () => ({ current: null }) };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: (key, params = {}) => {
            if (key === 'parking_count') key += params.count === 1 ? '_one' : '_other';
            const value = key.split('.').reduce((value, part) => value?.[part], translations) ?? key;
            return Object.entries(params).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), value);
        } }) };

        if (name === '@/hooks/use-media-query') return { useMediaQuery: () => false };
        if (name === '@/hooks/use-debounced-value') return { useDebouncedValue: (value) => value };
        if (name === '@/hooks/use-search-recent') return { useRecentSearches: () => ({ items: [], add() {}, clear() {} }) };
        if (name === './search-store') return { useSearchOpen: () => true, useSearchQuery: () => 'Amsterdam', setSearchQuery() {}, closeSearch() {} };
        if (name === '@/routes/destinations') return { resolve: { url: ({ query }) => `/destinations/resolve?q=${query.q}` } };
        if (name === '@/routes') return { locationMap: { url: ({ query }) => `/map?${new URLSearchParams(query)}` } };
        if (name === '@/lib/utils') return { cn: (...values) => values.join(' ') };
        if (name === '@/components/ui/button') return { Button: ({ children, ...props }) => React.createElement('button', props, children) };
        if (name.startsWith('@/components/ui/') || name === '@radix-ui/react-visually-hidden') return new Proxy({}, { get: () => primitive });
        return require(name);
    } };
    vm.runInNewContext(source, context);
    return { tree: context.exports.default(), requests, location };
}
function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props?.children)) {
        const result = find(child, predicate);
        if (result) return result;
    }
}

test('search presents readable streets, source context and an explicit destination action', () => {
    const { tree } = mount([{ key: 'municipal:1', type: 'municipal', label: 'Aalbersestraat', sub: 'Amsterdam' }]);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /Find parking near “Amsterdam”/);
    assert.match(html, /Aalbersestraat/);
    assert.match(html, /Municipal parking location/);
    assert.match(html, /Suggestions and parking locations/);
});

test('submitting resolves the query even if there is only one parking suggestion', async () => {
    const instance = mount([{ key: 'municipal:1', type: 'municipal', label: 'Aalbersestraat', latitude: 1, longitude: 2 }]);
    find(instance.tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
    await setImmediate();
    assert.deepEqual(instance.requests, ['/destinations/resolve?q=Amsterdam']);
    assert.match(instance.location.href, /destination=Amsterdam/);
    assert.match(instance.location.href, /lat=52.37/);
});


test('a street suggestion shows its location count and opens the full group extent', () => {
    const { tree, location } = mount([
        { key: 'internal:street:a', type: 'street', label: 'Sloterdijkerweg', sub: 'Amsterdam', latitude: 52.3887, longitude: 4.854, parking_count: 13,
          bounds: { south: 52.38, north: 52.39, west: 4.85, east: 4.86 } },
    ]);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /13 parking locations/);
    assert.doesNotMatch(html, /Location 1|data-marker/);
    find(tree, (node) => node.type === 'button' && node.props.className?.includes('group flex')).props.onClick();
    assert.match(location.href, /destination=Sloterdijkerweg%2C\+Amsterdam/);
    assert.match(location.href, /south=52.38/);
    assert.match(location.href, /east=4.86/);
});
