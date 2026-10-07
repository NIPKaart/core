import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/dashboard.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const stats = { added: 4, published: 3, pending: 1, confirmed: 0 };
const props = {
    profile: { name: 'Klaas Schoute', role: 'Beheerder', member_since: '2024-03-12T09:00:00+00:00' },
    stats,
    favorites: [],
    activity: [],
};

function render(pageProps) {
    const route = (name) => () => ({ url: `/${name}` });
    const context = {
        exports: {},
        Intl,
        require: (name) => {
            if (name === '@/utils/translation') return { translateSourceValue: (_, key) => key };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key, i18n: { language: 'nl' } }) };
            if (name === '@/layouts/app-layout') return { default: ({ children }) => React.createElement('main', null, children) };
            if (name === '@/components/ui/button') return { Button: ({ children }) => children };
            if (name === '@/components/map/contributions-map') return { default: () => React.createElement('div', { 'data-map': true }) };
            if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
            if (name === '@inertiajs/react')
                return {
                    Head: () => null,
                    Deferred: ({ children }) => children,
                    usePage: () => ({ props: { auth: { user: { name: 'Klaas Schoute' } } } }),
                    Link: ({ children, href }) => React.createElement('a', { href: typeof href === 'string' ? href : href.url }, children),
                };
            if (name === '@/routes') return { dashboard: route('dashboard'), locationMap: route('map') };
            if (name === '@/routes/app') return { default: { moderation: { index: route('moderation') } } };
            if (name === '@/routes/location-map') return { default: { add: route('add') } };
            if (name === '@/routes/notifications') return { default: { index: route('notifications') } };
            if (name === '@/routes/profile') return { default: { favorites: { index: route('favorites') } } };
            if (name.startsWith('@/actions/')) return { index: route('imports'), show: (id) => ({ url: `/imports/${id}` }) };
            return require(name);
        },
    };
    vm.runInNewContext(source, context);
    return renderToStaticMarkup(React.createElement(context.exports.default, { ...props, ...pageProps }));
}

test('people without moderation work start from their figures and their own map', () => {
    const html = render({ hasTodo: false, map: { spaces: [], favorites: [] } });
    assert.match(html, /data-map/);
    assert.match(html, /stats\.hint\.added/);
    assert.match(html, /href="\/favorites"/);
    assert.doesNotMatch(html, /href="\/(moderation|imports)/);
});

test('moderators land on the queue, each item opening its review, without a map', () => {
    const html = render({
        hasTodo: true,
        todo: {
            moderation: { total: 8, high: 1, types: { submission: 8 }, oldest: '2026-10-01T09:00:00+00:00' },
            queue: [
                {
                    key: 'submission:7',
                    type: 'submission',
                    priority: 'high',
                    street: 'Oudegracht 7',
                    municipality: 'Utrecht',
                    contributor: 'Jan Bakker',
                    reports: null,
                    waiting_since: '2026-10-01T09:00:00+00:00',
                    url: '/app/moderation/submissions/7',
                },
            ],
            sources: { total: 0, items: [] },
        },
    });
    assert.match(html, /Oudegracht 7/);
    assert.match(html, /href="\/app\/moderation\/submissions\/7"/);
    assert.match(html, /href="\/moderation"/);
    assert.match(html, /todo\.high/);
    assert.doesNotMatch(html, /data-map/);
    assert.doesNotMatch(html, /href="\/imports/);
});

test('administrators get each data source that needs attention with its own action', () => {
    const html = render({
        hasTodo: true,
        todo: {
            moderation: null,
            queue: [],
            sources: {
                total: 1,
                items: [{ id: 3, name: 'Gemeente Utrecht', status: 'awaiting_review', import_id: 12, since: '2026-10-04T09:00:00+00:00' }],
            },
        },
    });
    assert.match(html, /Gemeente Utrecht/);
    assert.match(html, /href="\/imports\/12"/);
    assert.match(html, /todo\.source_tag\.awaiting_review/);
});
