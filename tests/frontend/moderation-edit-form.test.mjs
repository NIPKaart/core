import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/moderation/edit-form.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(source, context);
const { toForm, fromForm } = context.exports;

const values = {
    latitude: 52.0925,
    longitude: 5.1355,
    street: 'Biltstraat',
    orientation: 'perpendicular',
    under_sign: 'yes',
    under_sign_text: 'Uitgezonderd vergunninghouders',
    parking_time: 90,
    restriction_days: ['mon', 'tue'],
    restriction_starts_at: '09:00:00',
    restriction_ends_at: '18:00:00',
    description: null,
};

/** Applies form changes one after another, each to the latest values, as the moderation draft does. */
function apply(start, ...changes) {
    return changes.reduce((current, [key, value]) => ({ ...current, ...fromForm(current, key, value) }), start);
}

test('the moderation values open in the add flow form as it expects them', () => {
    const form = toForm(values);
    assert.equal(form.orientation, 'perpendicular');
    assert.equal(form.parking_hours, '1');
    assert.equal(form.parking_minutes, '30');
    assert.equal(form.restriction_starts_at, '09:00');
    assert.equal(form.description, '');
    assert.equal(toForm({ ...values, parking_time: null }).parking_hours, '');
});

test('a duration chosen in the form sets hours and minutes together', () => {
    // The form's duration buttons set hours and then minutes right after each other.
    assert.equal(apply(values, ['parking_hours', '2'], ['parking_minutes', '0']).parking_time, 120);
    assert.equal(apply(values, ['parking_hours', '0'], ['parking_minutes', '30']).parking_time, 30);
    assert.equal(apply(values, ['parking_hours', ''], ['parking_minutes', '']).parking_time, null);
});

test('an emptied field becomes unknown rather than an empty value', () => {
    const cleared = apply(values, ['under_sign_text', '  '], ['restriction_days', []], ['restriction_ends_at', ''], ['orientation', '']);
    assert.equal(cleared.under_sign_text, null);
    assert.equal(cleared.restriction_days, null);
    assert.equal(cleared.restriction_ends_at, null);
    assert.equal(cleared.orientation, null);
    assert.equal(apply(values, ['under_sign', 'no']).under_sign, 'no');
    assert.equal(apply(values, ['description', 'Naast de huisartsenpraktijk.']).description, 'Naast de huisartsenpraktijk.');
});

test('changes to fields moderation does not edit leave the values alone', () => {
    assert.equal(JSON.stringify(fromForm(values, 'latitude', 1)), '{}');
});
