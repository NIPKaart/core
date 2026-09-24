import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const translations = JSON.parse(readFileSync(new URL('../../resources/locales/backend/en/global.json', import.meta.url), 'utf8'));
const t = (key, params = {}) => {
    const value = key.split('.').reduce((value, part) => value?.[part], translations) ?? key;
    return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), value);
};
const element = (tag) => ({ children, ...props }) => React.createElement(tag, props, children);
function load(path) {
    const source = ts.transpileModule(readFileSync(new URL(`../../resources/js/${path}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const context = { exports: {}, require: (name) => {
        if (name === 'react-i18next') return { useTranslation: () => ({ t }) };
        if (name === '@inertiajs/react') return { router: {} };
        if (name.startsWith('@/routes')) return {};
        if (name === './columns-selector') return { ColumnsSelector: () => null };
        if (name === '@/components/ui/input') return { Input: element('input') };
        if (name === '@/components/ui/table') return Object.fromEntries(Object.entries({ Table: 'table', TableHeader: 'thead', TableBody: 'tbody', TableRow: 'tr', TableHead: 'th', TableCell: 'td' }).map(([key, tag]) => [key, element(tag)]));
        if (name === '@/components/ui/button') return { Button: (props) => {
            const attributes = { ...props };
            delete attributes.variant;
            delete attributes.size;
            return React.createElement('button', attributes);
        } };
        if (name === '@/components/ui/switch') return { Switch: ({ checked }) => React.createElement('input', { type: 'checkbox', checked, readOnly: true }) };
        if (name.startsWith('@/components/ui/')) return new Proxy({}, { get: () => element('span') });
        return require(name);
    } };
    vm.runInNewContext(source, context);
    return context.exports;
}
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test('table exposes scoped search, keyboard sorting and restrained initial columns', () => {
    const { DataTable } = load('components/tables/data-table.tsx');
    const html = render(DataTable, {
        data: [{ name: 'Visible place', id: 'technical-id' }],
        columns: [{ accessorKey: 'name', header: 'Location' }, { accessorKey: 'id', header: 'ID' }],
        initialState: { columnVisibility: { id: false }, sorting: [{ id: 'name', desc: false }] },
    });
    assert.match(html, /aria-label="Search this page…"/);
    assert.match(html, /aria-sort="ascending"/);
    assert.match(html, /<button[^>]*>Location/);
    assert.match(html, /Visible place/);
    assert.doesNotMatch(html, /technical-id/);
    const empty = render(DataTable, { data: [], columns: [{ accessorKey: 'name' }], initialState: { globalFilter: 'Absent' } });
    assert.match(empty, /No matches on this page/);
});

test('pagination has a clear empty state and genuinely disabled unavailable navigation', () => {
    const { DataTablePagination } = load('components/tables/data-paginate.tsx');
    const empty = render(DataTablePagination, { pagination: { total: 0, from: null, to: null, last_page: 1 } });
    assert.match(empty, /No results/);
    assert.doesNotMatch(empty, /null|<nav/);
    const first = render(DataTablePagination, { pagination: { total: 40, from: 1, to: 20, current_page: 1, last_page: 2, prev_page_url: null, next_page_url: '/page2', links: [{ label: '1', active: true, url: '/page1' }, { label: '2', active: false, url: '/page2' }] } });
    assert.match(first, /disabled=""[^>]*aria-label="Previous page"/);
    assert.match(first, /Page 1 of 2/);
    assert.match(first, /aria-current="page"[^>]*>1<\/button>/);
    assert.match(first, />2<\/button>/);
});

test('offstreet unknown availability remains unknown and visibility uses its own permission', () => {
    const { getParkingOffstreetColumns } = load('pages/backend/parking-offstreet/columns.tsx');
    const columns = getParkingOffstreetColumns((permission) => permission === 'parking-offstreet.update', { t: (key) => key, tGlobal: (key) => key });
    const row = { original: { id: 'garage', visibility: true, short_capacity: 100, free_space_short: null } };
    for (const id of ['parking_status', 'short_parking']) {
        assert.equal(render(columns.find((column) => column.id === id).cell, { row }), '<span class="text-muted-foreground">—</span>');
    }
    assert.match(render(columns.find((column) => column.accessorKey === 'visibility').cell, { row }), /type="checkbox"/);
    const full = { original: { ...row.original, free_space_short: 0 } };
    assert.match(render(columns.find((column) => column.id === 'parking_status').cell, { row: full }), /badges.full/);
});


test('table toolbar can be replaced or suppressed without changing the rows', () => {
    const { DataTable } = load('components/tables/data-table.tsx');
    const props = { data: [{ name: 'Review location' }], columns: [{ accessorKey: 'name' }], filters: React.createElement('button', null, 'Default filter') };
    const standard = render(DataTable, props);
    assert.match(standard, /Search this page/);
    assert.match(standard, /Default filter/);

    const suppressed = render(DataTable, { ...props, toolbar: null });
    assert.doesNotMatch(suppressed, /Search this page|Default filter/);
    assert.match(suppressed, /Review location/);

    const custom = render(DataTable, { ...props, toolbar: React.createElement('button', null, 'Review toolbar') });
    assert.match(custom, /Review toolbar/);
    assert.doesNotMatch(custom, /Search this page|Default filter/);
    assert.match(custom, /Review location/);
});
