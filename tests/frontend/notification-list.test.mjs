import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const labels = JSON.parse(readFileSync(new URL('../../resources/locales/global/en/notification.json', import.meta.url), 'utf8')).labels;
const icons = new Proxy({}, { get: (_, name) => () => React.createElement('svg', { 'data-icon': name }) });
const source = ts.transpileModule(
    readFileSync(new URL('../../resources/js/components/notifications/list-notifications.tsx', import.meta.url), 'utf8'),
    {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    },
).outputText;
const context = {
    exports: {},
    Intl,
    require: (name) => {
        if (name === '@/utils/translation') return { translateSourceValue: (_, key) => key };
        if (name === '@/locale-sync') return { formatLocale: (language) => (language === 'en' ? 'en-GB' : language) };
        if (name === '@/components/localized-date-time') {
            const dateContext = { exports: {}, require: context.require };
            const dateSource = ts.transpileModule(
                readFileSync(new URL('../../resources/js/components/localized-date-time.tsx', import.meta.url), 'utf8'),
                { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
            ).outputText;
            vm.runInNewContext(dateSource, dateContext);
            return dateContext.exports;
        }
        if (name === 'lucide-react') return icons;
        if (name === 'react-i18next')
            return {
                useTranslation: () => ({ t: (key, options) => (options?.reason ? `${key}: ${options.reason}` : key), i18n: { language: 'en' } }),
            };
        if (name === '@/utils/notifications') return { getNotificationLabel: (_, type) => labels[type] ?? labels.default };
        if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
        if (name === '@inertiajs/react')
            return { Link: ({ children, href, className }) => React.createElement('a', { href, className }, children), router: {} };
        return require(name);
    },
};
vm.runInNewContext(source, context);
const { NotificationsList } = context.exports;

const notification = (type, params) => ({
    id: type,
    type,
    read_at: null,
    created_at: new Date().toISOString(),
    data: { type, params, url: '/admin/imports', meta: {} },
});
const render = (items) => renderToStaticMarkup(React.createElement(NotificationsList, { items, onMarkOne: () => {} }));

test('notifications name their subject so identical titles can be told apart', () => {
    const html = render([
        notification('dataset.source_awaiting_approval', { source_name: 'Eindhoven gehandicaptenparkeerplaatsen' }),
        notification('dataset.source_awaiting_reapproval', { source_name: 'Amsterdam parkeergarages en P+R' }),
        notification('community.space_submitted', { space_label: 'Teststraat 1' }),
    ]);
    assert.match(html, /Source awaiting approval.*Eindhoven gehandicaptenparkeerplaatsen/s);
    assert.match(html, /Changed source awaiting approval.*Amsterdam parkeergarages en P\+R/s);
    assert.match(html, /Teststraat 1/);
});

test('each notification type has its own icon', () => {
    const html = render([
        notification('dataset.source_awaiting_approval', {}),
        notification('dataset.import_ready_for_review', {}),
        notification('community.space_deleted', {}),
    ]);
    for (const icon of ['Database', 'FileSearch', 'Trash2']) {
        assert.match(html, new RegExp(`data-icon="${icon}"`));
    }
    assert.doesNotMatch(html, /data-icon="BellRing"/);
});

test('a decision with a reason names that reason below the subject', () => {
    const html = render([
        notification('community.improvement_rejected', { space_label: 'Breestraat', reason: 'improvement.spam' }),
        notification('community.improvement_approved', { space_label: 'Kerkstraat', reason: null }),
    ]);
    assert.match(html, /Breestraat.*reason: reasons\.improvement\.spam/s);
    assert.equal(html.match(/reason: /g).length, 1);
});

test('marking one read is a button beside the link, not inside it, and only for unread notifications', () => {
    const read = { ...notification('community.space_restored', { space_label: 'Vredenburg 40' }), id: 'read', read_at: new Date().toISOString() };
    const html = render([notification('community.space_submitted', { space_label: 'Prinsengracht 263' }), read]);
    assert.doesNotMatch(html, /<a[^>]*>(?:(?!<\/a>).)*<button/s);
    assert.equal(html.match(/aria-label="actions\.markRead"/g).length, 1);
    assert.equal(html.match(/status\.unread/g).length, 1);
});

test('an empty unread list says everything has been read', () => {
    const empty = (caughtUp) => renderToStaticMarkup(React.createElement(NotificationsList, { items: [], caughtUp, onMarkOne: () => {} }));
    assert.match(empty(true), /empty\.caughtUp/);
    assert.match(empty(false), /empty\.title/);
});
