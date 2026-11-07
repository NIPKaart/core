import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/imports/source-sheet.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
let language = null;
const translations = Object.fromEntries(
    ['nl', 'en'].map((locale) => [
        locale,
        JSON.parse(readFileSync(new URL(`../../resources/locales/backend/${locale}/imports.json`, import.meta.url), 'utf8')),
    ]),
);
const t = (key, params = {}) => {
    if (!language) return key;
    if ('count' in params) key += params.count === 1 ? '_one' : '_other';
    const value = key.split('.').reduce((value, part) => value?.[part], translations[language]) ?? key;
    return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), value);
};
const passThrough = ({ children }) => React.createElement(React.Fragment, null, children);
const context = {
    exports: {},
    require: (name) => {
        if (name === 'react' || name === 'react/jsx-runtime') return require(name);
        if (name === 'react-i18next') return { useTranslation: () => ({ t, i18n: { language: 'nl' } }) };
        if (name === '@/actions/App/Http/Controllers/Admin/DatasetImportController')
            return { index: () => '/admin/imports?tab=deliveries', show: (id) => `/admin/imports/${id}` };
        if (name === '@/routes/app/parking-municipal') return { __esModule: true, default: { municipality: (id) => `/admin/municipal/${id}` } };
        if (name === '@inertiajs/react') return { Link: ({ href, children }) => React.createElement('a', { href }, children) };
        if (name === '@/components/ui/sheet')
            return {
                Sheet: passThrough,
                SheetContent: passThrough,
                SheetDescription: passThrough,
                SheetTitle: ({ children }) => React.createElement('h2', null, children),
            };
        if (name === '@/components/ui/button') return { Button: passThrough };
        if (name === '@/components/municipal-date-time') return { __esModule: true, default: () => 'date' };
        if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
        if (name === './source-approval')
            return { __esModule: true, default: ({ children, history }) => React.createElement('section', null, 'approval', children, history) };
        if (name === './source-status') return { SourceStatus: () => 'status', SourceType: () => 'type' };
        return new Proxy({}, { get: () => () => null });
    },
};
vm.runInNewContext(source, context);

const description = {
    publisher: 'Gemeente Amsterdam',
    licence: 'CC0',
    attribution: 'Gemeente Amsterdam; parkeervakken E6a.',
    source_url: 'https://api.data.amsterdam.nl',
    terms_url: 'https://data.amsterdam.nl',
    expected_interval_hours: 24,
};
const sourceRow = (overrides = {}) => ({
    id: 7,
    name: 'Amsterdam algemene gehandicaptenparkeerplaatsen',
    target_type: 'municipal',
    municipality_id: 3,
    municipality_name: 'Amsterdam',
    municipality_code: 'GM0363',
    subdivision: 'NL-NH',
    subdivision_name: 'Noord-Holland',
    country: 'NL',
    approval_state: 'approved',
    status: 'published',
    processing: false,
    description,
    pending_description: null,
    needs_review: false,
    latest_import: { id: 11, state: 'published', retrieved_at: '2026-10-30T12:00:00Z' },
    last_published_retrieved_at: '2026-10-30T12:00:00Z',
    visible_locations_count: 1425,
    latest_observation_at: null,
    ...overrides,
});
const render = (source) => renderToStaticMarkup(React.createElement(context.exports.default, { source, onClose() {} }));

test('a delivery waiting for review leads the sheet with a link to review it', () => {
    const html = render(
        sourceRow({
            needs_review: true,
            status: 'awaiting_review',
            latest_import: { id: 11, state: 'pending', retrieved_at: '2026-10-30T12:00:00Z' },
        }),
    );
    assert.ok(html.indexOf('sheet.review_ready') < html.indexOf('on_map'));
    assert.match(html, /href="\/admin\/imports\/11"/);
    assert.doesNotMatch(render(sourceRow()), /sheet\.review_ready/);
});

test('the sheet shows what is on the map and offers municipal locations only for municipal sources', () => {
    const municipal = render(sourceRow());
    assert.match(municipal, /1\.425/);
    assert.match(municipal, /href="\/admin\/municipal\/3"/);
    assert.match(municipal, /href="\/admin\/imports\?tab=deliveries"/);

    const offstreet = render(sourceRow({ target_type: 'offstreet', last_published_retrieved_at: null }));
    assert.doesNotMatch(offstreet, /\/admin\/municipal\//);
    assert.match(offstreet, /sources_table\.not_published/);
});

test('a source without a licence says so', () => {
    assert.match(render(sourceRow({ description: { ...description, licence: null } })), /approval\.no_licence/);
});

test('an unapproved source shows its approval instead of repeating the source details', () => {
    const html = render(sourceRow({ approval_state: 'pending', latest_import: null, last_published_retrieved_at: null }));
    assert.match(html, /<section>approval/);
    assert.doesNotMatch(html, /sheet\.about/);
    assert.doesNotMatch(html, /on_map/);
    assert.doesNotMatch(html, /history/);
    assert.match(render(sourceRow({ approval_state: 'pending' })), /on_map/);
    assert.match(render(sourceRow({ approval_state: 'rejected' })), /<section>approval.*history/);
});

for (const [locale, catalog, hours, occupancy, interval] of [
    ['nl', 'Leveringsritme catalogus', 'Elke 24 uur', 'Actuele bezetting', 'Elke 2 minuten opgehaald'],
    ['en', 'Catalog delivery interval', 'Every 24 hours', 'Current occupancy', 'Fetched every 2 minutes'],
]) {
    test(`${locale}: offstreet details distinguish daily catalogs from two-minute occupancy retrieval`, () => {
        language = locale;
        try {
            const html = render(sourceRow({ target_type: 'offstreet' }));
            assert.ok(html.includes(catalog));
            assert.ok(html.includes(hours));
            assert.ok(html.includes(occupancy));
            assert.ok(html.includes(interval));
            assert.ok(!render(sourceRow()).includes(interval));
        } finally {
            language = null;
        }
    });
}
