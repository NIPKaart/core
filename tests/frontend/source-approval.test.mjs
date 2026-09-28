import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const translations = JSON.parse(readFileSync(new URL('../../resources/locales/backend/en/imports.json', import.meta.url), 'utf8'));
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/imports/source-approval.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const t = (key, params = {}) => {
    if ('count' in params) key += params.count === 1 ? '_one' : '_other';
    const value = key.split('.').reduce((value, part) => value?.[part], translations) ?? key;
    return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), value);
};
const context = {
    exports: {},
    require: (name) => {
        if (name === 'react-i18next') return { useTranslation: () => ({ t }) };
        if (name === '@/actions/App/Http/Controllers/Admin/DatasetSourceController') return { update: { form: () => ({}) } };
        if (name === '@inertiajs/react') return { Form: ({ children }) => children({ errors: {}, processing: false }) };
        if (name === '@/components/ui/button') return { Button: ({ children, value }) => React.createElement('button', { value }, children) };
        if (name === '@/components/ui/textarea') return { Textarea: (props) => React.createElement('textarea', props) };
        if (name === '@/components/input-error') return { default: ({ message }) => React.createElement('p', null, message) };
        return require(name);
    },
};
vm.runInNewContext(source, context);
const Approval = context.exports.default;
const { changedFields } = context.exports;

const description = {
    name: 'Eindhoven gehandicaptenparkeerplaatsen',
    publisher: 'Gemeente Eindhoven',
    source_url: 'https://data.eindhoven.nl/explore/dataset/parkeerplaatsen/',
    licence: null,
    terms_url: 'https://data.eindhoven.nl/explore/dataset/parkeerplaatsen/information/',
    attribution: 'Gemeente Eindhoven',
    area: { country: 'NL', subdivision: 'NL-NB', municipality: { scheme: 'nl-cbs', code: 'GM0772', name: 'Eindhoven' } },
    bounds: [5.32, 51.35, 5.62, 51.52],
    expected_interval_hours: 24,
};
const render = (overrides) =>
    renderToStaticMarkup(
        React.createElement(Approval, {
            source: { id: 1, approval_state: 'pending', description, pending_description: null, registration_error: null, review_reason: null, ...overrides },
        }),
    );

test('a new source shows what the administrator approves, including a missing licence', () => {
    const html = render({});
    assert.match(html, /New source awaiting approval/);
    assert.match(html, /No licence stated/);
    assert.match(html, /Eindhoven \(GM0772\) · NL-NB · NL/);
    assert.match(html, /Every 24 hours/);
    assert.match(html, /value="approve"/);
    assert.match(html, /value="reject"/);
});

test('a changed description names the changed fields but ignores a new delivery interval', () => {
    assert.deepEqual([...changedFields(description, { ...description, expected_interval_hours: 48 })], []);
    const html = render({ pending_description: { ...description, licence: 'CC0-1.0', expected_interval_hours: 48 } });
    assert.match(html, /Changed source description awaiting approval/);
    assert.match(html, /Changed since the last approval: Licence/);
    assert.match(html, /CC0-1\.0/);
});

test('registration problems are announced and a rejected source can only be approved again', () => {
    const html = render({ approval_state: 'rejected', registration_error: 'Land NL of provincie NL-XX is niet bekend.', review_reason: 'Licence unclear' });
    assert.match(html, /role="alert"[^>]*>.*NL-XX/);
    assert.match(html, /Source rejected/);
    assert.match(html, /Reason: Licence unclear/);
    assert.doesNotMatch(html, /value="reject"/);
});
