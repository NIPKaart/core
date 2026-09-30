import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/lib/destination-icon.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {}, require: (name) => (name === 'leaflet' ? { default: { divIcon: (options) => options } } : require(name)) };
vm.runInNewContext(source, context);
test('the destination marker has an accessible name and safely renders destination text', () => {
    const icon = context.exports.destinationIcon('Bestemming: <img src=x onerror="alert(1)">');
    assert.match(icon.html, /role="img" aria-label="Bestemming: &lt;img/);
    assert.doesNotMatch(icon.html, /<img src=x|onerror="alert/);
    assert.doesNotMatch(icon.html, /accessible-pin|wheelchair/);
    assert.match(icon.html, /<svg/);
    assert.equal(icon.iconAnchor[0], icon.iconSize[0] / 2);
    assert.deepEqual(Array.from(icon.iconSize), [40, 48]);
    assert.deepEqual(Array.from(icon.iconAnchor), [20, 44]);
});

test('approximate destinations use a centered area symbol instead of a pin', () => {
    const icon = context.exports.destinationIcon('Zoekgebied rond Amstel (benaderd)', true);
    assert.match(icon.html, /destination-marker__area/);
    assert.doesNotMatch(icon.html, /<svg|accessible-pin/);
    assert.equal(icon.iconAnchor[0], icon.iconSize[0] / 2);
    assert.equal(icon.iconAnchor[1], icon.iconSize[1] / 2);
});
