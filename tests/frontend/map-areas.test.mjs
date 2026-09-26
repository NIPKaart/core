import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/lib/map-areas.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(source, context);
const { expandPoint } = context.exports;

test('compact area records expand to the shared parking result', () => {
    assert.deepEqual(
        { ...expandPoint(['offstreet:garage-1', 52, 5, 'Garage']) },
        { key: 'offstreet:garage-1', source: 'offstreet', id: 'garage-1', latitude: 52, longitude: 5, title: 'Garage', distance_metres: null },
    );
});
