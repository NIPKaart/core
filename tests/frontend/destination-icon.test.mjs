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
const context = { exports: {}, require: name => name === 'leaflet' ? { default: { divIcon: options => options } } : require(name) };
vm.runInNewContext(source, context);
test('the destination marker has an accessible name and safely renders destination text', () => {
    const icon = context.exports.destinationIcon('Bestemming: <img src=x onerror="alert(1)">');
    assert.match(icon.html, /role="img" aria-label="Bestemming: &lt;img/);
    assert.doesNotMatch(icon.html, /<img|onerror="alert/);
    assert.match(icon.html, /<svg/);
    assert.equal(icon.iconAnchor[0], icon.iconSize[0] / 2);
    assert.ok(icon.iconAnchor[1] > icon.iconSize[1] * 0.9, 'the pin tip marks the coordinate');
});
