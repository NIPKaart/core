import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const locales = Object.fromEntries(['home', 'garages'].map((name) => [name, JSON.parse(readFileSync(new URL(`../../resources/locales/frontend/nl/${name}.json`, import.meta.url)))]));
const modules = {};
function load(path) {
    if (modules[path]) return modules[path];
    const source = ts.transpileModule(readFileSync(new URL(`../../resources/js/${path}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const context = { exports: {}, require: (name) => {
        if (name === 'react-i18next') return { useTranslation: (namespace) => ({ t: (key) => key.split('.').reduce((value, part) => value?.[part], locales[namespace?.split('/').at(-1)]) ?? key, i18n: { language: 'nl' } }) };
        if (name === '@/components/frontend/garage-table') return load('components/frontend/garage-table.tsx');
        if (name === '@/lib/garage-overview') return load('lib/garage-overview.ts');
        if (name === '@/components/map/parking-detail/utils') return load('components/map/parking-detail/utils.tsx');
        if (name === '@/components/map/parking-detail/parts') return { Chip: ({ children }) => React.createElement('span', null, children) };
        if (name === '@/components/ui/progress') return { Progress: () => React.createElement('div', { role: 'progressbar' }) };
        if (name === '@/components/map/parking-detail/navigation-handoff') return { navigationUrl: () => 'https://maps.example.test' };
        if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
        if (name === '@/locale-sync') return { formatLocale: () => 'nl-NL' };
        if (name === '@/routes') return { locationMap: { url: () => '/map' } };
        if (name === 'lucide-react') return { MapPin: () => null, Navigation: () => null };
        if (name.startsWith('@/')) return {};
        return require(name);
    }};
    vm.runInNewContext(source, context);
    modules[path] = context.exports;
    return context.exports;
}
const Preview = load('components/frontend/home/home-garage-preview.tsx').default;

test('missing live data keeps three garage rows without live claims or navigation to fictitious locations', () => {
    const html = renderToStaticMarkup(React.createElement(Preview, { garages: null }));

    assert.equal((html.match(/<li /g) ?? []).length, 3);
    assert.match(html, /Garage Centrum/);
    assert.match(html, /P\+R Stadsrand/);
    assert.match(html, /128/);
    assert.doesNotMatch(html, /Voorbeeld|Live|<time|href=/);
});

test('available live data replaces the fallback and retains real measurement times and navigation', () => {
    const html = renderToStaticMarkup(React.createElement(Preview, { garages: {
        municipality: { name: 'Utrecht', garages: [{ id: 'real', name: 'Real garage', type: 'garage', latitude: 52.1, longitude: 5.1, availability: 'current', occupancy_status: 'counting', observed_at: '2026-10-11T21:00:00Z', capacity: 300, free_space: 42 }] }, total: 1,
    } }));

    assert.match(html, /Real garage/);
    assert.match(html, /<time/);
    assert.match(html, /href="\/map"/);
    assert.doesNotMatch(html, /Garage Centrum|P\+R Stadsrand/);
});
