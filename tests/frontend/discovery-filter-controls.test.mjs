import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/map/discovery-filters.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const defaults = { source: 'all', radius: 1000, sort: 'balanced' };
function mount(desktop = false) {
    const state = [];
    let index = 0;
    const applied = [];
    let value = { source: 'municipal', radius: 500, sort: 'distance' };
    const context = { exports: {}, require: name => {
        if (name === 'react') return { useId: () => 'filters', useState: initial => {
            const key = index++;
            if (!(key in state)) state[key] = initial;
            return [state[key], next => { state[key] = next; }];
        } };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: key => key }) };
        if (name === '@/hooks/use-media-query') return { useMediaQuery: () => desktop };
        if (name === '@/lib/discovery-filters') return { defaultDiscoveryFilters: defaults };
        if (name.startsWith('@/components/ui/')) return new Proxy({}, { get: (_, key) => key });
        return require(name);
    } };
    vm.runInNewContext(source, context);
    return { applied, render: () => { index = 0; return context.exports.default({ value, onChange: next => { value = next; applied.push(next); } }); } };
}
function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
        const found = find(child, predicate);
        if (found) return found;
    }
    return null;
}
function select(tree, value) { return find(tree, node => node.type === 'Select' && node.props.value === value); }
for (const desktop of [false, true]) {
    test(`${desktop ? 'dialog' : 'drawer'} only applies the draft on submit and discards cancelled changes`, () => {
        const app = mount(desktop);
        let tree = app.render();
        assert.equal(tree.type, desktop ? 'Dialog' : 'Drawer');
        tree.props.onOpenChange(true);
        tree = app.render();
        select(tree, '500').props.onValueChange('250');
        assert.equal(app.applied.length, 0);
        tree.props.onOpenChange(false);
        tree = app.render();
        tree.props.onOpenChange(true);
        tree = app.render();
        assert.ok(select(tree, '500'));
        select(tree, 'distance').props.onValueChange('balanced');
        tree = app.render();
        find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
        assert.deepEqual({ ...app.applied[0] }, { source: 'municipal', radius: 500, sort: 'balanced' });
        assert.equal(app.render().props.open, false);
    });
}
test('reset restores every default as a draft before applying', () => {
    const app = mount();
    let tree = app.render();
    tree.props.onOpenChange(true);
    tree = app.render();
    find(tree, node => node.type === 'Button' && node.props.children === 'filters.reset').props.onClick();
    assert.equal(app.applied.length, 0);
    tree = app.render();
    assert.ok(select(tree, 'all'));
    assert.ok(select(tree, '1000'));
    assert.ok(select(tree, 'balanced'));
    find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.deepEqual({ ...app.applied[0] }, defaults);
});
