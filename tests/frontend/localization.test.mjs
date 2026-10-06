import i18next from 'i18next';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const locales = new URL('../../resources/locales/', import.meta.url);
function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
        return entry.isDirectory() ? files(url) : [url];
    });
}
const resources = { en: {}, nl: {} };
for (const file of files(locales)) {
    const [, domain, language, namespace] = file.pathname.match(/locales\/([^/]+)\/(en|nl)\/(.+)\.json$/);
    resources[language][`${domain}/${namespace}`] = JSON.parse(readFileSync(file, 'utf8'));
}
function leaves(value, prefix = '', result = {}) {
    for (const [key, item] of Object.entries(value)) {
        const name = prefix ? `${prefix}.${key}` : key;
        if (typeof item === 'object') leaves(item, name, result);
        else result[name] = item;
    }
    return result;
}
function placeholders(value) {
    return [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((match) => match[1]).sort();
}

test('Dutch and English catalogs cover the same messages and preserve interpolation variables', () => {
    assert.deepEqual(Object.keys(resources.en).sort(), Object.keys(resources.nl).sort());
    for (const [namespace, english] of Object.entries(resources.en)) {
        const en = leaves(english);
        const nl = leaves(resources.nl[namespace]);
        assert.deepEqual(Object.keys(en).sort(), Object.keys(nl).sort(), namespace);
        for (const key of Object.keys(en)) {
            assert.ok(en[key].trim(), `${namespace}:${key} en`);
            assert.ok(nl[key].trim(), `${namespace}:${key} nl`);
            assert.deepEqual(placeholders(en[key]), placeholders(nl[key]), `${namespace}:${key}`);
        }
    }
});

function load(path, i18n) {
    const source = ts.transpileModule(readFileSync(new URL(`../../resources/js/${path}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const element =
        (tag) =>
        ({ children, ...props }) => {
            const attributes = Object.fromEntries(
                Object.entries(props).filter(([name]) => !['asChild', 'size', 'variant', 'showClose'].includes(name)),
            );
            return React.createElement(tag, attributes, children);
        };
    const context = {
        exports: {},
        require: (name) => {
        if (name === '@/locale-sync') return { formatLocale: (language) => language === 'en' ? 'en-GB' : language };
            if (name === 'react-i18next') return { useTranslation: (ns) => ({ t: i18n.getFixedT(i18n.language, ns), i18n }) };
            if (name === '@/hooks/use-appearance') return { useAppearance: () => ({ appearance: 'light', updateAppearance: () => {} }) };
            if (name === '@/hooks/use-search-hotkey') return { useSearchHotkey: () => {} };
            if (name === './search-store') return { openSearch: () => {} };
            if (name === '@/components/ui/tooltip') return new Proxy({}, { get: () => element('span') });
            if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
            if (name === '@/components/ui/button') return { Button: element('button'), buttonVariants: () => '' };
            if (name === '@radix-ui/react-dialog') return new Proxy({}, { get: (_, key) => element(key === 'Close' ? 'button' : 'div') });
            return require(name);
        },
    };
    vm.runInNewContext(source, context);
    return context.exports;
}
const render = (component, props = {}) => renderToStaticMarkup(React.createElement(component, props));

for (const [language, expected] of Object.entries({
    en: {
        close: 'Close',
        previous: 'Previous page',
        next: 'Next page',
        date: '06/10/2026',
        announcement: 'System announcement',
        theme: 'Switch theme (Light mode)',
        search: 'Search',
    },
    nl: {
        close: 'Sluiten',
        previous: 'Vorige pagina',
        next: 'Volgende pagina',
        date: '06-10-2026',
        announcement: 'Systeem aankondiging',
        theme: 'Schakel thema (Licht thema)',
        search: 'Zoeken',
    },
})) {
    test(`shared controls, notification titles and dates use ${language} without fallback`, async () => {
        const i18n = i18next.createInstance();
        await i18n.init({ resources, lng: language, fallbackLng: false });
        const { ThemeToggle } = load('components/frontend/nav/theme-toggle.tsx', i18n);
        assert.ok(render(ThemeToggle).includes(`aria-label="${expected.theme}"`));
        const SearchButton = load('components/search/search-button.tsx', i18n).default;
        assert.ok(render(SearchButton).includes(`aria-label="${expected.search}"`));
        const { DialogContent } = load('components/ui/dialog.tsx', i18n);
        const { SheetContent } = load('components/ui/sheet.tsx', i18n);
        assert.ok(render(DialogContent).includes(`>${expected.close}<`));
        assert.ok(render(SheetContent).includes(`>${expected.close}<`));
        const pagination = load('components/ui/pagination.tsx', i18n);
        assert.ok(render(pagination.PaginationPrevious).includes(`aria-label="${expected.previous}"`));
        assert.ok(render(pagination.PaginationNext).includes(`aria-label="${expected.next}"`));
        assert.equal(i18n.t('titles.system.announcement', { ns: 'backend/notifications' }), expected.announcement);
        const DateTime = load('components/localized-date-time.tsx', i18n).default;
        const date = render(DateTime, { value: '2026-10-06T12:00:00', dateOnly: true });
        assert.ok(date.includes(expected.date));
        const relative = render(DateTime, { value: '2026-10-06T12:00:00', children: 'relative label' });
        assert.ok(relative.includes(`title="${expected.date}`));
        assert.ok(relative.includes('12:00'));
        assert.ok(relative.includes('>relative label</time>'));
    });
}

test('literal message lookups in known page namespaces resolve in both languages without fallback', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources, fallbackLng: false });
    const sources = files(new URL('../../resources/js/', import.meta.url)).filter((file) => file.pathname.endsWith('.tsx'));
    let lookups = 0;
    for (const file of sources) {
        const source = readFileSync(file, 'utf8');
        let namespace = source.match(/use(?:Resource)?Translation\(['"]([^'"]+)['"]\)/)?.[1];
        const page = new URL('index.tsx', file);
        if (!namespace && existsSync(page)) {
            namespace = readFileSync(page, 'utf8').match(/useResourceTranslation\(['"]([^'"]+)['"]\)/)?.[1];
        }
        if (!namespace) continue;
        for (const match of source.matchAll(/\bt\(['"]([^'"]+)['"]/g)) {
            for (const lng of ['en', 'nl']) {
                lookups++;
                assert.ok(i18n.exists(match[1], { ns: namespace, lng, count: 2 }), `${file.pathname}: ${lng} ${namespace}:${match[1]}`);
            }
        }
    }
    assert.ok(lookups > 2000);
});
