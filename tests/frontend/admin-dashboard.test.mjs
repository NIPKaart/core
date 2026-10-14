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
    section: 'destinations',
    contributions: { data: [], current_page: 1, prev_page_url: null, next_page_url: null },
    profile: { name: 'Klaas Schoute', role: 'Beheerder', member_since: '2024-03-12T09:00:00+00:00' },
    stats,
    favorites: [],
    activity: [],
};

function render(pageProps) {
    const route = (name) => Object.assign(() => ({ url: `/${name}` }), { url: () => `/${name}` });
    const context = {
        exports: {},
        Intl,
        require: (name) => {
            if (name === '@/components/confirm-dialog') return { ConfirmDialog: () => null };
            if (name === '@/routes/profile/parking-spaces') return { destroy: route('withdraw') };
            if (name === '@/lib/saved-places') return {};
            if (name === '@/components/map/destinations') return { default: () => React.createElement('div', { 'data-destinations': true }) };
            if (name === '@/components/map/favorites') return { default: () => React.createElement('div', { 'data-favorites': true }) };
            if (name === '@/components/ui/tabs') return {
                Tabs: ({ children }) => React.createElement('div', null, children),
                TabsList: ({ children }) => React.createElement('div', { role: 'tablist' }, children),
                TabsTrigger: ({ children }) => React.createElement('button', { role: 'tab' }, children),
                TabsContent: ({ children, value }) => value === (pageProps.section ?? 'destinations') ? children : null,
            };
            if (name === '@/utils/translation') return { translateSourceValue: (_, key) => key };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key, i18n: { language: 'nl' } }) };
            if (name === '@/layouts/app-layout') return { default: ({ children }) => React.createElement('main', null, children) };
            if (name === '@/components/ui/button') return { Button: ({ children, asChild, disabled }) => asChild ? children : React.createElement('button', { disabled }, children) };
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

test('people without moderation work start from destinations favorites and contributions without counters', () => {
    const html = render({ hasTodo: false, map: { spaces: [], favorites: [] } });
    assert.match(html, /data-destinations/);
    assert.match(html, /contributions\.title/);
    assert.doesNotMatch(html, /stats\.|data-map|notifications/);
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


test('the contributions tab shows current statuses reasons and map or edit actions instead of a notification inbox', () => {
    const html = render({ hasTodo: false, section: 'contributions', contributions: {
        data: [
            { key: 'submission:1', kind: 'submission', label: 'Museumstraat', at: '2026-10-01T09:00:00Z', status: 'pending', withdraw_id: '1', reason: null, url: '/map/add/1/edit', action: 'edit' },
            { key: 'improvement:2', kind: 'improvement', label: 'Kerkstraat', at: '2026-10-02T09:00:00Z', status: 'rejected', reason: '<rejection>', url: '/map?place=community:2', action: 'map' },
        ], current_page: 1, prev_page_url: null, next_page_url: null,
    } });
    assert.match(html, /Museumstraat/);
    assert.match(html, /contributions\.withdraw\.label/);
    assert.match(html, /contributions\.status\.pending/);
    assert.match(html, /href="\/map\/add\/1\/edit"/);
    assert.match(html, /&lt;rejection&gt;/);
    assert.match(html, /contributions\.actions\.map/);
    assert.doesNotMatch(html, /notifications|stats\.hint/);
});

test('contribution pagination keeps unavailable directions disabled and the next page reachable', () => {
    const html = render({ hasTodo: false, section: 'contributions', contributions: {
        data: [{ key: 'report:1', kind: 'report', label: null, at: '2026-10-01T09:00:00Z', status: 'removed', reason: null, url: null, action: null }],
        current_page: 1, prev_page_url: null, next_page_url: '/dashboard?section=contributions&contributions_page=2',
    } });
    assert.match(html, /disabled/);
    assert.match(html, /contributions_page=2/);
    assert.match(html, /contributions\.status\.removed/);
    assert.doesNotMatch(html, /contributions\.actions\./);
});
