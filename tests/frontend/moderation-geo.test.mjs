import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/moderation/geo.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(source, context);
const { metres, nearestWithin, nudge, panelMode, NUDGE_METRES, NUDGE_FAR_METRES } = context.exports;

const biltstraat = { latitude: 52.0925, longitude: 5.1355 };

test('the arrow keys move the pin by the stated distance in the direction of the key', () => {
    for (const [key, distance] of [
        ['ArrowUp', NUDGE_METRES],
        ['ArrowDown', NUDGE_METRES],
        ['ArrowLeft', NUDGE_FAR_METRES],
        ['ArrowRight', NUDGE_FAR_METRES],
    ]) {
        const moved = nudge(biltstraat, key, distance);
        // Rounded to whole metres, as the moderator sees it: half a metre shows as 1 or 0, five metres as 5.
        assert.equal(Math.abs(metres(biltstraat, moved) - distance) <= 0.5, true, key);
    }
    assert.ok(nudge(biltstraat, 'ArrowUp', 5).latitude > biltstraat.latitude);
    assert.ok(nudge(biltstraat, 'ArrowDown', 5).latitude < biltstraat.latitude);
    assert.ok(nudge(biltstraat, 'ArrowRight', 5).longitude > biltstraat.longitude);
    assert.ok(nudge(biltstraat, 'ArrowLeft', 5).longitude < biltstraat.longitude);
    assert.equal(nudge(biltstraat, 'ArrowRight', 5).latitude, biltstraat.latitude);
});

test('repeated small steps add up to the distance the pin travelled', () => {
    let point = biltstraat;
    for (let step = 0; step < 30; step++) point = nudge(point, 'ArrowDown', NUDGE_METRES);
    assert.equal(metres(biltstraat, point), 15);
});

test('only places within the radius count as nearby', () => {
    const near = nudge(biltstraat, 'ArrowUp', 12);
    const far = nudge(biltstraat, 'ArrowUp', 800);
    assert.equal(nearestWithin(biltstraat, [far, near], 500), 12);
    assert.equal(nearestWithin(biltstraat, [far], 500), null);
    assert.equal(nearestWithin(biltstraat, [], 500), null);
});

test('the panel shows a selection before an open item, and the queue when neither is there', () => {
    assert.equal(panelMode(false, 0), 'queue');
    assert.equal(panelMode(true, 0), 'item');
    assert.equal(panelMode(true, 2), 'selection');
    assert.equal(panelMode(false, 1), 'selection');
});
