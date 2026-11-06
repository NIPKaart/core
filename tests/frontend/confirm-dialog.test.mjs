import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const common = JSON.parse(readFileSync(new URL('../../resources/locales/global/nl/common.json', import.meta.url), 'utf8'));
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/confirm-dialog.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const element =
    (tag) =>
    ({ children }) =>
        React.createElement(tag, null, children);
const context = {
    exports: {},
    require: (name) => {
        if (name === 'react' || name === 'react/jsx-runtime') return require(name);
        if (name === 'react-i18next')
            return { useTranslation: () => ({ t: (key) => key.split('.').reduce((value, part) => value?.[part], common) ?? key }) };
        if (name === '@/components/ui/alert-dialog')
            return {
                AlertDialog: element('div'),
                AlertDialogContent: element('div'),
                AlertDialogHeader: element('div'),
                AlertDialogFooter: element('div'),
                AlertDialogTitle: element('h2'),
                AlertDialogDescription: element('p'),
                AlertDialogTrigger: element('div'),
                AlertDialogCancel: element('button'),
                AlertDialogAction: element('button'),
            };
        if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
        if (name === './ui/button') return { buttonVariants: () => '' };
        return {};
    },
};
vm.runInNewContext(source, context);
const render = (props) => renderToStaticMarkup(React.createElement(context.exports.ConfirmDialog, { onConfirm() {}, ...props }));

test('a confirmation without its own button labels uses the translated defaults', () => {
    const html = render({ title: 'Bron verwijderen?' });
    assert.match(html, /<button>Annuleren<\/button>/);
    assert.match(html, /<button>Bevestigen<\/button>/);
    assert.doesNotMatch(html, /Cancel|Confirm/);
});

test('button labels passed by the caller still win', () => {
    const html = render({ confirmText: 'Verwijderen', cancelText: 'Terug' });
    assert.match(html, /<button>Terug<\/button>/);
    assert.match(html, /<button>Verwijderen<\/button>/);
});
