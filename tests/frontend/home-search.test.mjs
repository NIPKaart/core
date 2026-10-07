import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/frontend/home/home-search.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mount(query = '', props = {}) {
    const calls = [];
    const context = {
        exports: {},
        require: (name) => {
            if (name === '@/components/search/search-store')
                return {
                    useSearchQuery: () => query,
                    setSearchQuery: (value) => calls.push(['query', value]),
                    openSearch: () => calls.push(['open']),
                };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
            if (name === '@/routes') return { locationMap: () => ({ url: '/map' }) };
            if (name === '@inertiajs/react') return { Link: (props) => React.createElement('a', props) };
            return require(name);
        },
    };
    vm.runInNewContext(source, context);

    return { tree: context.exports.default(props), calls };
}

function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
        const result = find(child, predicate);
        if (result) return result;
    }
    return null;
}

test('typing a destination hands off to the shared search with the typed text', () => {
    const { tree, calls } = mount();
    const input = find(tree, (node) => node.props?.id === 'home-destination');
    input.props.onChange({ target: { value: 'Rijksmuseum' } });

    assert.deepEqual(calls, [['query', 'Rijksmuseum'], ['open']]);
});

test('submitting opens the shared search without leaving the page', () => {
    const { tree, calls } = mount('Utrecht');
    let prevented = false;
    tree.props.onSubmit({ preventDefault: () => (prevented = true) });

    assert.equal(prevented, true);
    assert.deepEqual(calls, [['query', 'Utrecht'], ['open']]);
    assert.equal(find(tree, (node) => node.props?.htmlFor === 'home-destination').props.children, 'hero.label');
});

test('the label can be visually hidden where a heading already asks the question', () => {
    const label = (props) => find(mount('', props).tree, (node) => node.props?.htmlFor === 'home-destination');

    assert.equal(label({ hideLabel: true }).props.className, 'sr-only');
    assert.notEqual(label({}).props.className, 'sr-only');
});
