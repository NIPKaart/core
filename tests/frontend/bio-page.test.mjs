import i18next from 'i18next';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const routes = { home: '/', locationMap: '/map', garages: '/garages', about: '/about', contact: '/contact', add: '/map/add' };
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/frontend/bio.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

async function page(language, props = {}) {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: language, resources: { [language]: { bio: JSON.parse(readFileSync(new URL(`../../resources/locales/frontend/${language}/bio.json`, import.meta.url))) } } });
    const context = {
        exports: {},
        require(name) {
            if (name === 'react-i18next') return { useTranslation: () => ({ t: i18n.getFixedT(language, 'bio') }) };
            if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
            if (name === '@/routes' || name === '@/routes/location-map') return Object.fromEntries(Object.entries(routes).map(([key, url]) => [key, () => ({ url, method: 'get' })]));
            if (name === '@inertiajs/react') return {
                Head: () => null,
                Link: ({ href, children, ...attributes }) => React.createElement('a', { ...attributes, href: href.url }, children),
            };
            if (name === '@/components/ui/button') return { Button: ({ children, className }) => React.cloneElement(children, { className }) };
            return require(name);
        },
    };
    vm.runInNewContext(source, context);
    return renderToStaticMarkup(React.createElement(context.exports.default, { campaign: null, links: [], socials: [], canonical: 'https://example.com/bio', socialImage: '', ...props }));
}

test('the bio stays useful without optional campaign, link or social sections in both languages', async () => {
    for (const [language, title, action] of [['nl', 'Weten waar je kunt parkeren.', 'Vind een parkeerplaats'], ['en', 'Know where you can park.', 'Find a parking space']]) {
        const html = await page(language);
        assert.ok(html.includes(title));
        assert.ok(html.includes('href="/map"'));
        assert.ok(html.includes(action));
        assert.ok(!html.includes('<nav'));
        assert.ok(!html.includes('bio-campaign'));
        assert.equal((html.match(/<h1/g) ?? []).length, 1);
    }
});

test('the main action precedes the campaign and all configured destinations work without requiring a map', async () => {
    const html = await page('nl', {
        campaign: { id: 'campaign', title: 'Samen maken we de kaart completer.', note: 'Ken je een parkeerplaats?', action: 'Help mee', route: 'location-map.add', image: '/assets/images/bio/community-parking.webp' },
        links: [{ id: 'garages', route: 'garages', title: 'Garages en P+R' }, { id: 'github', url: 'https://github.com/NIPKaart', title: 'GitHub' }],
        socials: [{ id: 'social', url: 'https://example.com/profile', title: 'Officieel profiel' }],
    });

    assert.ok(html.indexOf('Vind een parkeerplaats') < html.indexOf('id="bio-campaign"'));
    assert.ok(html.includes('href="/map/add"'));
    assert.ok(html.includes('href="/garages"'));
    assert.ok(html.includes('href="https://github.com/NIPKaart"'));
    assert.ok(html.includes('href="https://example.com/profile"'));
    assert.ok(html.includes('aria-label="Volg NIPKaart"'));
    assert.ok(html.includes('alt=""'));
});

test('configured titles and notes are escaped and campaigns work without an image', async () => {
    const html = await page('en', { campaign: { id: 'campaign', title: '<script>alert(1)</script>', note: '<b>Text</b>', action: 'Help us out', url: 'https://example.com/help', image: null } });

    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('&lt;b&gt;Text&lt;/b&gt;'));
    assert.ok(html.includes('href="https://example.com/help"'));
    assert.ok(!html.includes('alt=""'));
    assert.ok(!html.includes('<script>'));
});
