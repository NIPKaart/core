import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(
    readFileSync(new URL('../../resources/js/pages/backend/moderation/proposal-validation.tsx', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function render(validation, language = 'nl') {
    const messages = JSON.parse(readFileSync(new URL(`../../resources/locales/backend/${language}/moderation.json`, import.meta.url), 'utf8'))
        .proposals.validation;
    const t = (key, params = {}) => {
        const path = key.split('.');
        const message = path.reduce((part, name) => part?.[name], messages);
        const plural =
            'count' in params
                ? path.slice(0, -1).reduce((part, name) => part?.[name], messages)?.[path.at(-1) + (params.count === 1 ? '_one' : '_other')]
                : null;
        return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), message ?? plural ?? key);
    };
    const context = {
        exports: {},
        require(name) {
            if (name === 'react') return { ...React, useState: () => [validation, () => {}], useEffect() {} };
            if (name === 'react/jsx-runtime') return require(name);
            if (name === 'react-i18next') return { useTranslation: () => ({ t }) };
            if (name === '@inertiajs/react') return { useHttp: () => ({}) };
            if (name === '@/routes/app/moderation/proposals/validation') return { show: {}, start: {} };
            if (name === '@/components/ui/button') return { Button: (props) => React.createElement('button', props) };
            throw Error('Unexpected import ' + name);
        },
    };
    vm.runInNewContext(source, context);
    return renderToStaticMarkup(React.createElement(context.exports.default, { proposal: 1, point: 2 }));
}

const completed = {
    status: 'completed',
    board: 'supported',
    linkedViews: 3,
    bayCount: null,
    mappedBays: 2,
    ndwMatch: null,
    views: ['1588529463015544'],
    subsign: 'present',
    coverage: { analyzed: 6, selected: 6, partial: false },
};

test('Staalweg shows sign support and indicative bay outlines with a separate unknown official count', () => {
    const html = render(completed);
    assert.match(html, /E6 ondersteund door 3 kijkhoeken/);
    assert.match(html, /Indicatieve contouren voor 2 parkeervakken/);
    assert.match(html, /https:\/\/www.mapillary.com\/app\/\?pKey=1588529463015544/);
    assert.match(html, /type onbekend/);
});

test('Kerkpolderpad has no positive sign claim when no E6 was observed', () => {
    const html = render({ ...completed, board: 'not_observed', linkedViews: 0, mappedBays: 0, views: [], subsign: 'unknown' });
    assert.match(html, /Geen E6 gezien/);
    assert.doesNotMatch(html, /E6 ondersteund|mapillary.com/);
});

for (const language of ['nl', 'en']) {
    test(`Arcadeltstraat explains an uncertain NDW association and keeps its evidence views in ${language}`, () => {
        const html = render(
            { ...completed, board: 'inconclusive', mappedBays: 0, ndwMatch: { status: 'ambiguous', targetDistance: 2.2, alternativeDistance: 4 } },
            language,
        );
        assert.match(html, language === 'nl' ? /koppeling aan dit NDW-punt onzeker/ : /association with this NDW point uncertain/);
        assert.match(html, /2.2 m/);
        assert.match(html, /4 m/);
        assert.match(html, /mapillary.com/);
        assert.doesNotMatch(html, /board.inconclusive|match.ambiguous/);
    });
}
