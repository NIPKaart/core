import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compile = (path) =>
    ts.transpileModule(readFileSync(new URL(`../../resources/js/${path}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
const utils = { exports: {} };
vm.runInNewContext(compile('components/map/parking-detail/utils.tsx'), { exports: utils.exports, require: () => ({}) });
const context = { exports: {}, require: () => utils.exports };
vm.runInNewContext(compile('lib/garage-occupancy.ts'), context);
const { garageBadge } = context.exports;
const labels = { full: 'Full', closed: 'Closed', unavailable: 'No live data', free: (count, formatted) => `${formatted} free (${count})` };
const badge = (occupancy) => {
    const result = garageBadge(occupancy, labels);
    return result && { ...result };
};

test('never measured and status-only "free" stay bare pins', () => {
    assert.equal(garageBadge(undefined, labels), null);
    assert.equal(badge(['counting', null, 400]), null);
    assert.equal(badge(['open', null, null]), null);
});

test('temporarily missing live data is marked, without a count', () => {
    assert.deepEqual(badge(['unavailable', null, null]), { text: '', tone: 'grey', label: 'No live data', unavailable: true });
});

test('closed and full are words, never a zero count', () => {
    assert.deepEqual(badge(['closed', null, null]), { text: 'Closed', tone: 'grey', label: 'Closed' });
    assert.deepEqual(badge(['full', null, null]), { text: 'Full', tone: 'red', label: 'Full' });
    assert.deepEqual(badge(['counting', 0, 328]), { text: 'Full', tone: 'red', label: 'Full' });
});

test('the free count uses the detail tones and no thousands separator', () => {
    assert.deepEqual(badge(['counting', 550, 710]), { text: '550', tone: 'green', label: '550 free (550)' });
    assert.equal(badge(['counting', 150, 710]).tone, 'orange');
    assert.equal(badge(['counting', 20, 710]).tone, 'red');
    assert.equal(badge(['counting', 1084, 1087]).text, '1084');
});

test('more free than capacity shows the raw count without judging occupancy', () => {
    assert.deepEqual(badge(['counting', 535, 410]), { text: '535', tone: 'green', label: '535 free (535)' });
});
