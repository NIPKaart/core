import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const translations = JSON.parse(readFileSync(new URL('../../resources/locales/backend/en/moderation.json', import.meta.url), 'utf8'));
const t = (key, params = {}) => {
    const value = key.split('.').reduce((value, part) => value?.[part], translations) ?? key;
    return Object.entries(params).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)), value);
};
let expanded = false;
const cache = new Map();
function sourceModule(path) {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {}, require: moduleRequire };
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../resources/js/${path}.tsx`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, module);
    cache.set(path, module.exports);
    return module.exports;
}
function moduleRequire(name) {
    if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
    if (name.startsWith('@/')) return sourceModule(name.slice(2));
    return require(name);
}
const context = {
    exports: {},
    require: (name) => {
        if (name === 'react-i18next') return { useTranslation: () => ({ t, i18n: { language: 'en' } }) };
        if (name === 'react') return { ...React, useState: () => [expanded, (value) => { expanded = value; }] };
        return moduleRequire(name);
    },
};
vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/moderation/parts.tsx', import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    context,
);
const { CommunityPointsContext, ContributorName } = context.exports;

test('new contributors have zero community points and no implied negative reliability', () => {
    const community_points = { score: 0, reviewed: 0, first_recorded_at: null, outcomes: [], recent: [] };
    const html = renderToStaticMarkup(React.createElement(CommunityPointsContext, { community_points }));
    assert.match(html, /community points/);
    assert.match(html, />0<\/p>/);
    assert.match(html, /No recorded reviewed contributions yet/);
    assert.match(html, /Contributor/);
    assert.doesNotMatch(html, /View reviewed outcomes/);
    assert.doesNotMatch(html, /Recent contributions/);
});

test('moderator context explains outcome reasons and incomplete history without weights', () => {
    const community_points = {
        score: 125,
        reviewed: 3,
        first_recorded_at: '2026-01-01T10:00:00Z',
        outcomes: [
            { kind: 'submission', outcome: 'submission.approved', reason: null, count: 1 },
            { kind: 'submission', outcome: 'neutral', reason: 'duplicate', count: 2 },
        ],
        recent: [{ kind: 'submission', outcome: 'neutral', reason: 'duplicate', decided_at: '2026-01-02T10:00:00Z' }],
    };
    expanded = true;
    const html = renderToStaticMarkup(React.createElement(CommunityPointsContext, { community_points, name: 'Jan Bakker' }));
    expanded = false;
    assert.match(html, /community points/);
    assert.match(html, />125<\/p>/);
    assert.match(html, /Approved/);
    assert.match(html, /Jan Bakker/);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, /Duplicate/);
    assert.match(html, /Recent contributions/);
    assert.match(html, /not a complete lifetime history/);
    assert.doesNotMatch(html, /community_points\.outcomes|weight|formula/);
    const name = renderToStaticMarkup(React.createElement(ContributorName, { contributor: { name: '<script>', approved: 2, rejected: 0, is_new: false, community_points } }));
    assert.match(name, /&lt;script&gt;/);
    assert.match(name, /125 community points/);
});

test('an anonymized contributor has no community points profile to display', () => {
    assert.equal(renderToStaticMarkup(React.createElement(CommunityPointsContext, { community_points: null })), '');
});


test('neutral rejection history is not rendered as a reliability warning when reviewed community points is available', () => {
    const community_points = { score: 0, reviewed: 10, first_recorded_at: null, outcomes: [], recent: [] };
    const html = renderToStaticMarkup(React.createElement(ContributorName, { contributor: { name: 'Contributor', approved: 0, rejected: 10, is_new: false, community_points } }));
    assert.match(html, /community points/);
    assert.match(html, /0 community points/);
    assert.doesNotMatch(html, /contributor.rejected|rejected contributions/);
});
