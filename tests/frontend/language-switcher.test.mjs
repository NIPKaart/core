import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/language-switcher.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

test('language selection waits for the server, rejects duplicate requests and unlocks after failure', () => {
    const requests = [];
    const pending = { current: false };
    const props = { locale: 'en', localization: { available: [ { code: 'en', label: 'English' }, { code: 'nl', label: 'Nederlands' } ] } };
    const context = { exports: {}, require: (name) => {
        if (name === 'react') return { useRef: () => pending, useState: () => [false, () => {}] };
        if (name === 'react/jsx-runtime') return jsxRuntime;
        if (name === '@inertiajs/react') return { usePage: () => ({ props }), router: { patch: (...args) => requests.push(args) } };
        if (name === '@/routes/locale') return { default: { update: () => '/settings/locale' } };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
        return new Proxy({}, { get: (_, key) => key });
    }};
    vm.runInNewContext(source, context);
    const tree = context.exports.default();
    const items = tree.props.children[1].props.children;
    assert.equal(items[1].props.children, 'Nederlands');
    items[1].props.onSelect();
    items[1].props.onSelect();
    assert.equal(requests.length, 1);
    assert.equal(props.locale, 'en');
    requests[0][2].onFinish();
    items[1].props.onSelect();
    assert.equal(requests.length, 2);
    assert.equal(props.locale, 'en');
    requests[1][2].onFinish();
    items[0].props.onSelect();
    assert.equal(requests.length, 2);
});


test('successful same-page updates and browser history both synchronize the server locale', () => {
    const listeners = new Map();
    const languages = [];
    const source = ts.transpileModule(readFileSync(new URL('../../resources/js/locale-sync.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const context = { exports: {}, require: (name) => name === './i18n'
        ? { default: { options: {}, changeLanguage: (language) => languages.push(language) } }
        : { router: { on: (event, callback) => { listeners.set(event, callback); return () => listeners.delete(event); } } }
    };
    vm.runInNewContext(source, context);
    context.exports.configureLocalization({ available: [{ code: 'en', formatLocale: 'en-GB' }, { code: 'nl', formatLocale: 'nl-NL' }], fallback: 'en' });
    assert.equal(context.exports.formatLocale('en'), 'en-GB');
    assert.equal(context.exports.formatLocale('nl'), 'nl-NL');
    const cleanup = context.exports.registerLocaleSynchronization();
    listeners.get('success')({ detail: { page: { props: { locale: 'nl' } } } });
    listeners.get('navigate')({ detail: { page: { props: { locale: 'en' } } } });
    assert.deepEqual(languages, ['nl', 'en']);
    cleanup();
    assert.equal(listeners.size, 0);
});
