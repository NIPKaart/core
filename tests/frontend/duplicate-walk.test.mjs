import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../resources/js/pages/backend/moderation/duplicate-walk.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function find(node, predicate) {
    if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
    if (!node?.props) return undefined;
    return predicate(node) ? node : find(node.props.children, predicate);
}

function findAll(node, predicate, found = []) {
    if (Array.isArray(node)) node.forEach((child) => findAll(child, predicate, found));
    else if (node?.props) {
        if (predicate(node)) found.push(node);
        findAll(node.props.children, predicate, found);
    }
    return found;
}

function load() {
    const listeners = [];
    const jsx = (type, props) => ({ type, props });
    const tags = new Proxy({}, { get: (_, name) => String(name) });
    const modules = {
        'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
        react: { useEffect: (effect) => effect() },
        'react-i18next': {
            useTranslation: () => ({ t: (key) => ({ 'proposals.walk_ok_key': 'j', 'proposals.walk_missing_key': 'n' })[key] ?? key }),
        },
        '@/components/map/parking-detail/navigation-handoff': { streetViewUrl: () => 'https://example.test/streetview' },
        '@/lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') },
        './location-proposals': { ExistingLine: 'ExistingLine', toLocationProposal: (row) => ({ street: `Delft #${row.id}` }) },
    };
    const context = {
        exports: {},
        window: { addEventListener: (type, listener) => listeners.push(listener), removeEventListener() {} },
        require: (name) => modules[name] ?? tags,
    };
    vm.runInNewContext(compiled, context);
    return { DuplicateWalk: context.exports.DuplicateWalk, listeners };
}

const overlap = { source: 'municipal', id: 'm1', street: 'Markt', latitude: 52.011, longitude: 4.36002, distance_metres: 1.4 };
const rows = [1, 2, 3].map((id) => ({
    id,
    municipality: 'Delft',
    status: 'open',
    bayCount: null,
    points: [{ id: id * 10, latitude: 52.011, longitude: 4.36, overlap }],
}));

function render(walk, handlers = {}) {
    const { DuplicateWalk, listeners } = load();
    const calls = { answers: [], closed: null, jumped: null };
    const view = DuplicateWalk({
        rows,
        walk,
        reasonLabel: 'Already on the map',
        closing: false,
        onAnswer: (row, answer) => calls.answers.push([row.id, answer]),
        onPrevious() {},
        onJump: (index) => (calls.jumped = index),
        onRestart() {},
        onStop() {},
        onClose: (ids) => (calls.closed = ids),
        ...handlers,
    });
    return { view, calls, listeners };
}

test('asks about one sign at a time with nothing answered in advance', () => {
    const { view, calls } = render({ index: 1, answers: { 1: 'ok' } });
    assert.ok(find(view, (node) => node.props.children === 'proposals.walk_question'));
    const buttons = findAll(view, (node) => node.type === 'Button' && node.props['aria-keyshortcuts']);
    assert.deepEqual(
        buttons.map((button) => button.props['aria-keyshortcuts']),
        ['j', 'n'],
    );
    buttons[1].props.onClick();
    assert.deepEqual(calls.answers, [[2, 'missing']]);
    assert.equal(
        find(view, (node) => node.props.children?.[0] === 'proposals.close_selected'),
        undefined,
    );
});

test('answers with the keyboard, but not while typing', () => {
    const { calls, listeners } = render({ index: 0, answers: {} });
    listeners[0]({ key: 'J', target: { closest: () => null } });
    listeners[0]({ key: 'n', target: { closest: () => ({}) } });
    assert.deepEqual(calls.answers, [[1, 'ok']]);
});

test('the summary closes only the signs confirmed as complete', () => {
    const { view, calls } = render({ index: 3, answers: { 1: 'ok', 2: 'missing', 3: 'ok' } });
    const close = find(view, (node) => node.type === 'Button' && node.props.className?.includes('flex-[2]'));
    assert.equal(close.props.disabled, false);
    close.props.onClick();
    assert.deepEqual(calls.closed, [1, 3]);
});

test('jumps to another sign from the progress list', () => {
    const { view, calls } = render({ index: 0, answers: {} });
    const steps = findAll(view, (node) => node.type === 'button' && node.props.onClick && 'aria-current' in node.props);
    assert.equal(steps.length, 3);
    assert.equal(steps[0].props['aria-current'], 'step');
    steps[2].props.onClick();
    assert.equal(calls.jumped, 2);
});
