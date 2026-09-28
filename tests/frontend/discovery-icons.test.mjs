import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/lib/discovery-icons.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const timers = new Map();
let timerId = 0;
let reducedMotion = false;
const context = { setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id), window: { matchMedia: () => ({ matches: reducedMotion }) }, exports: {}, require: () => ({ default: { divIcon: options => options } }) };
vm.runInNewContext(source, context);
const { discoveryIcon } = context.exports;
test('street sources share one pin while garages get a P pin in both selection states', () => {
    for (const selected of [false, true]) {
        const street = discoveryIcon('community', selected);
        const garage = discoveryIcon('offstreet', selected);
        assert.equal(street, discoveryIcon('municipal', selected));
        assert.notEqual(garage.html, street.html);
        assert.match(garage.html, />P<\/text>/);
        assert.doesNotMatch(garage.html, /e105|<img/);
        for (const icon of [street, garage]) {
            assert.deepEqual([...icon.iconAnchor], [18, 46]);
            assert.equal(icon.className.includes('discovery-pin-selected'), selected);
        }
    }
});

test('a garage badge shows the free count in its tone and is escaped', () => {
    const badge = { text: '550', tone: 'green', label: '550 general spaces free' };
    const icon = discoveryIcon('offstreet', false, badge);
    assert.match(icon.html, /fill="#15803d"/);
    assert.match(icon.html, />550<\/text>/);
    assert.match(icon.html, /font-weight="800" font-size="14"/);
    assert.equal(icon, discoveryIcon('offstreet', false, { ...badge }));
    assert.notEqual(icon, discoveryIcon('offstreet', false, { ...badge, text: '549' }));
    assert.match(discoveryIcon('offstreet', false, { text: '<b>', tone: 'red', label: '' }).html, /&#60;b&#62;/);
    assert.match(discoveryIcon('offstreet', false, { text: 'Closed', tone: 'grey', label: 'Closed' }).html, /fill="#6b7280" stroke/);
});

test('a garage with temporarily missing live data shows a warning dot instead of a count', () => {
    const icon = discoveryIcon('offstreet', false, { text: '', tone: 'grey', label: 'No live data', unavailable: true });
    assert.match(icon.html, /fill="#d97706"/);
    assert.match(icon.html, /fill="#27313a"/);
    assert.doesNotMatch(icon.html, /font-weight="800"/);
    assert.notEqual(icon, discoveryIcon('offstreet'));
});

function marker() {
    return {
        icon: null, z: 0, classes: new Set(),
        setIcon(icon) { this.icon = icon; this.classes.clear(); return this; },
        setZIndexOffset(z) { this.z = z; return this; },
        getElement() { return { classList: { add: value => this.classes.add(value) } }; },
    };
}
function finishAnimations() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); }
test('deselection keeps the selected artwork until its exit animation finishes', () => {
    const pin = marker();
    context.exports.setMarkerSelected(pin, 'municipal', true);
    context.exports.setMarkerSelected(pin, 'municipal', false);
    assert.ok(pin.classes.has('parking-marker-deselecting'));
    assert.equal(pin.icon, discoveryIcon('municipal', true));
    finishAnimations();
    assert.equal(pin.icon, discoveryIcon('municipal'));
    assert.equal(pin.z, 0);
});
test('quick reselection cancels the previous exit and keeps the marker highlighted', () => {
    const pin = marker();
    context.exports.setMarkerSelected(pin, 'offstreet', true);
    context.exports.setMarkerSelected(pin, 'offstreet', false);
    context.exports.setMarkerSelected(pin, 'offstreet', true);
    finishAnimations();
    assert.equal(pin.icon, discoveryIcon('offstreet', true));
    assert.equal(pin.z, 1000);
    assert.equal(pin.classes.has('parking-marker-deselecting'), false);
});
test('reduced motion restores the normal icon immediately', () => {
    reducedMotion = true;
    const pin = marker();
    context.exports.setMarkerSelected(pin, 'municipal', true);
    context.exports.setMarkerSelected(pin, 'municipal', false);
    assert.equal(pin.icon, discoveryIcon('municipal'));
    assert.equal(timers.size, 0);
    reducedMotion = false;
});
