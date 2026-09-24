import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const translations = JSON.parse(readFileSync(new URL('../../resources/locales/backend/en/municipal-imports.json', import.meta.url), 'utf8'));
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/municipal-imports/source-comparison.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const context = {
    exports: {},
    require: (name) => {
        if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key.split('.').reduce((value, part) => value?.[part], translations) ?? key }) };
        if (name === '@/components/ui/button') return { Button: ({ children, onClick }) => React.createElement('button', { onClick }, children) };
        return require(name);
    },
};
vm.runInNewContext(source, context);
const Comparison = context.exports.default;
const claim = { street: 'Elzenhagensingel', number: 0, source_attributes: { orientation: 'Langs', regimes: [{ eTypeDescription: 'Accessible parking', dagen: ['ma', 'di'] }] } };
const render = (before, after, fields = []) => renderToStaticMarkup(React.createElement(Comparison, { row: { before, after, fields }, onShowMap() {} }));

test('missing and new locations show one meaningful side instead of a null comparison', () => {
    const missing = render(claim, null);
    assert.match(missing, /Elzenhagensingel/);
    assert.match(missing, />0</);
    assert.doesNotMatch(missing, /New source values|null|<pre/);
    assert.match(missing, /<details/);
    assert.match(missing, /Accessible parking/);
    const added = render(null, { ...claim, number: null });
    assert.match(added, /New in this delivery/);
    assert.match(added, /Unknown/);
    assert.doesNotMatch(added, /Previous source values/);
});

test('comparison emphasizes the changed value without emphasizing unchanged orientation', () => {
    const html = render(claim, { ...claim, number: 2 }, ['number', 'source_attributes']);
    assert.match(html, /font-semibold[^>]*>2</);
    assert.doesNotMatch(html, /font-semibold[^>]*>Langs</);
    assert.match(html, /<button>View on the map<\/button>/);
});


test('missing source context states actual visibility without suggesting deletion', () => {
    const Notice = context.exports.MissingSourceNotice;
    const renderNotice = (status, visibility) => renderToStaticMarkup(React.createElement(Notice, { row: { status, current: { visibility } } }));
    assert.match(renderNotice('missing', true), /remains visible on the map/);
    assert.match(renderNotice('missing', false), /remains hidden on the map/);
    assert.equal(renderNotice('new', true), '');
    assert.doesNotMatch(renderNotice('missing', undefined), /remains visible|remains hidden/);
});
