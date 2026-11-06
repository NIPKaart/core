import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/imports/index.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mount(tab) {
    let subscription;
    const index = () => '/admin/imports';
    index.url = index;
    const jsx = (type, props) => ({ type, props });
    const modules = {
        '@/actions/App/Http/Controllers/Admin/DatasetImportController': { index, store: { form: () => ({}) } },
        '@/hooks/use-import-updates': {
            useImportUpdates: (...args) => {
                subscription = args;
            },
        },
        'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
        'react/jsx-runtime': { jsx, jsxs: jsx },
    };
    const context = { exports: {}, require: (name) => modules[name] ?? new Proxy({}, { get: (_, key) => key }) };
    vm.runInNewContext(source, context);
    context.exports.default({
        datasets: [],
        sources: { data: [] },
        summary: { processing: true },
        countries: [],
        imports: { data: [] },
        filters: { tab, state: 'all' },
    });
    return JSON.parse(JSON.stringify(subscription));
}

test('the sources tab refreshes the source list, choices and summary without delivery history', () => {
    assert.deepEqual(mount('sources'), [
        ['datasets', 'sources', 'summary', 'countries'],
        true,
        { observationProps: ['sources', 'summary', 'counts'] },
    ]);
});

test('the deliveries tab refreshes history and source choices without the hidden source table', () => {
    assert.deepEqual(mount('deliveries'), [['datasets', 'summary', 'imports'], true, { observationProps: ['summary', 'counts'] }]);
});
