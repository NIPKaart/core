import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const translations = JSON.parse(readFileSync(new URL('../../resources/locales/frontend/en/map/main.json', import.meta.url), 'utf8'));
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/map/parking-results.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const context = { exports: {}, require: (name) => {
    if (name === 'react-i18next') return { useTranslation: () => ({ t: (key, params = {}) => {
        if (key === 'results.count' || key === 'results.page_count') key += params.count === 1 ? '_one' : '_other';
        const value = key.split('.').reduce((value, part) => value?.[part], translations) ?? key;
        return Object.entries(params).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)), value);
    } }) };
    if (name === '@/components/ui/button') return { Button: ({ variant: _variant, ...props }) => React.createElement('button', props) };
    return require(name);
} };
vm.runInNewContext(source, context);
const Results = context.exports.default;
const result = (source, title = 'Main street') => ({ key: `${source}:1`, id: '1', source, title, latitude: 52, longitude: 4, distance_metres: null });
const defaults = { results: [], selectedKey: null, status: 'ready', onSelect() {}, onRetry() {} };
const render = (props) => renderToStaticMarkup(React.createElement(Results, { ...defaults, ...props }));

// Inspect event callbacks as well as markup, using the actual rendered component tree.
function buttons(node) {
    if (!node || typeof node !== 'object') return [];
    if (node.props?.onClick) return [node];
    return React.Children.toArray(node.props?.children).flatMap(buttons);
}

test('all sources have independently operable details and textual provenance even when IDs match', () => {
    const results = [result('community'), result('municipal'), result('offstreet')];
    const selected = [];
    const tree = Results({ ...defaults, results, onSelect: (item) => selected.push(item.key) });
    for (const button of buttons(tree)) button.props.onClick();
    assert.deepEqual(selected, ['community:1', 'municipal:1', 'offstreet:1']);
    const html = render({ results, selectedKey: 'municipal:1' });
    assert.match(html, /Community contribution/);
    assert.match(html, /Municipal data/);
    assert.match(html, /Parking facility/);
    assert.equal((html.match(/aria-haspopup="dialog"/g) ?? []).length, 3);
    assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
    assert.match(html, /Verification and current accessible-space availability are unknown/);
    assert.doesNotMatch(html, /m from the destination/);
});

test('unknown address has a readable fallback and known distance includes zero', () => {
    const html = render({ results: [{ ...result('municipal', ' '), distance_metres: 0 }, result('community', '<script>bad</script>')] });
    assert.match(html, /Parking location without an address/);
    assert.match(html, /0 m from the destination/);
    assert.doesNotMatch(html, /<script>/);
});

test('loading and failed requests are distinguished from an empty successful search and failure can be retried', () => {
    assert.match(render({ status: 'loading' }), /role="status"[^>]*>Loading parking locations/);
    assert.doesNotMatch(render({ status: 'loading' }), /no known parking locations/);
    const empty = render({});
    assert.match(empty, /no known parking locations/);
    assert.match(empty, /may still exist here/);
    const failed = render({ status: 'error' });
    assert.match(failed, /could not be loaded/);
    assert.doesNotMatch(failed, /no known parking locations/);
    let retries = 0;
    buttons(Results({ ...defaults, status: 'error', onRetry: () => retries++ }))[0].props.onClick();
    assert.equal(retries, 1);
});

test('all loaded results remain reachable and paging appears only when needed', () => {
    const html = render({ results: Array.from({ length: 500 }, (_, index) => ({ ...result('municipal'), key: `municipal:${index}` })) });
    assert.doesNotMatch(html, /Result pages/);
    assert.match(render({ hasMore: true, onPageChange() {} }), /Result pages/);
    const pages = [];
    const controls = buttons(Results({ ...defaults, page: 2, hasMore: true, onPageChange: (page) => pages.push(page) }));
    controls[0].props.onClick();
    controls[1].props.onClick();
    assert.deepEqual(pages, [1, 3]);
    assert.equal((html.match(/aria-haspopup="dialog"/g) ?? []).length, 500);
});
