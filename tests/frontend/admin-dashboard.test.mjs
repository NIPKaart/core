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

function render(permissions = [], admin = false) {
    const route = (name) => () => ({ url: `/${name}` });
    const context = {
        exports: {},
        require: (name) => {
            if (name === '@/hooks/use-authorization') return { useAuthorization: () => ({ can: (permission) => permissions.includes(permission), hasRole: () => admin }) };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === '@/layouts/app-layout') return { default: ({ children }) => React.createElement('main', null, children) };
            if (name === '@inertiajs/react') return { Head: () => null, Link: ({ children, href }) => React.createElement('a', { href: href.url }, children) };
            if (name === '@/routes') return { dashboard: route('dashboard'), locationMap: route('map') };
            if (name === '@/routes/profile') return { default: { parkingSpaces: { index: route('my-locations') }, favorites: { index: route('favorites') } } };
            if (name.startsWith('@/routes/app/')) return { default: { index: route(name.split('/').at(-1)) } };
            if (name.startsWith('@/actions/')) return { index: route('municipal-imports') };
            return require(name);
        },
    };
    vm.runInNewContext(source, context);
    return renderToStaticMarkup(React.createElement(context.exports.default));
}

test('dashboard keeps personal destinations and hides management without permissions', () => {
    const html = render();
    assert.match(html, /href="\/my-locations"/);
    assert.match(html, /href="\/favorites"/);
    assert.doesNotMatch(html, /href="\/(users|roles|parking-spaces|municipal-imports|parking-municipal)"/);
});

test('municipal staff get locations while administrators get the review entry point', () => {
    const staff = render(['parking-municipal.view_any']);
    assert.match(staff, /href="\/parking-municipal"/);
    assert.doesNotMatch(staff, /href="\/municipal-imports"/);
    const admin = render(['user.view_any'], true);
    assert.match(admin, /href="\/municipal-imports"/);
    assert.match(admin, /href="\/users"/);
    assert.doesNotMatch(admin, /href="\/roles"/);
});
