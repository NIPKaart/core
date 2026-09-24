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
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/municipal-imports/show.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const wrapper = ({ children }) => React.createElement('div', null, children);
const context = { exports: {}, require: (name) => {
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key.split('.').reduce((value, part) => value?.[part], translations) ?? key }) };
    if (name === 'react-leaflet') return { MapContainer: wrapper, GeoJSON: wrapper, TileLayer: () => null, Tooltip: wrapper, useMap: () => ({}) };
    return {};
} };
vm.runInNewContext(source, context);
const render = (rows) => renderToStaticMarkup(React.createElement(context.exports.ChangesMap, { rows, onSelect() {} }));
const geometry = { type: 'Polygon', coordinates: [[[4, 52], [4.01, 52], [4, 52.01], [4, 52]]] };

test('map includes unchanged records and missing records from the selected page', () => {
    const html = render([
        { external_id: 'unchanged-location', status: 'unchanged', after: { geometry } },
        { external_id: 'missing-location', status: 'missing', before: { geometry } },
    ]);
    assert.match(html, /unchanged-location/);
    assert.match(html, /missing-location/);
});

test('empty filtered map gives visible feedback', () => {
    assert.match(render([]), /role="status"/);
});
