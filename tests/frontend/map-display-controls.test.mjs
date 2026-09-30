import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/map/map-display-controls.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
        const result = find(child, predicate);
        if (result) return result;
    }
    return null;
}
test('map layers and legend are mutually exclusive and changing the layer closes the panel', () => {
    let panel = null,
        value = 'streets';
    const context = {
        exports: {},
        require: (name) => {
            if (name === 'react')
                return {
                    useState: () => [
                        panel,
                        (next) => {
                            panel = next;
                        },
                    ],
                };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name.startsWith('@/components/ui/')) return new Proxy({}, { get: (_, key) => key });
            if (name === '@/lib/pin-svg') return { pinSvg: () => '<svg></svg>' };
            return require(name);
        },
    };
    vm.runInNewContext(source, context);
    const render = () =>
        context.exports.default({
            value,
            onChange: (next) => {
                value = next;
            },
        });
    const popover = (tree, key) => find(tree, (node) => node.type === 'Popover' && node.key === key);
    popover(render(), 'legend').props.onOpenChange(true);
    assert.equal(popover(render(), 'legend').props.open, true);
    popover(render(), 'layers').props.onOpenChange(true);
    assert.equal(popover(render(), 'legend').props.open, false);
    const satellite = find(render(), (node) => node.type === 'Button' && node.key === 'satellite');
    assert.equal(satellite.props['aria-pressed'], false);
    satellite.props.onClick();
    assert.equal(value, 'satellite');
    assert.equal(popover(render(), 'layers').props.open, false);
    assert.equal(find(render(), (node) => node.type === 'Button' && node.key === 'satellite').props['aria-pressed'], true);
});
