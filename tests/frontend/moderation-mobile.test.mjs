import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const tags = new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : String(key)) });

/** Compiles one moderation file with hooks that keep their state between renders, so a test can click and render again. */
function mount(file, modules = {}) {
    const state = [];
    let cursor = 0;
    const context = {
        exports: {},
        require: (name) => {
            if (name in modules) return modules[name];
            if (name === 'react/jsx-runtime')
                return { Fragment: 'fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
            if (name === 'react')
                return {
                    useState: (initial) => {
                        const index = cursor++;
                        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
                        return [state[index], (value) => (state[index] = typeof value === 'function' ? value(state[index]) : value)];
                    },
                    useRef: (value) => ({ current: value }),
                    useMemo: (build) => build(),
                    useCallback: (callback) => callback,
                    useEffect: () => {},
                };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key, i18n: { language: 'nl' } }) };
            if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
            return tags;
        },
    };
    vm.runInNewContext(
        ts.transpileModule(readFileSync(new URL(`../../resources/js/pages/backend/moderation/${file}`, import.meta.url), 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
        context,
    );
    return {
        exports: context.exports,
        render: (component, props) => {
            cursor = 0;
            return component(props);
        },
    };
}

function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}

const queueModules = {
    './location-proposals': { LocationProposals: 'LocationProposals', SOURCE_COLOR: '#1e3a8a', toLocationProposal: (row) => row },
    './shortcuts': { Kbd: 'Kbd' },
    './type-badge': { TYPE_ICONS: {} },
    './types': { filterQuery: () => ({}) },
    './values': { useChangeSummary: () => () => '' },
    '@/routes/app': { default: { moderation: { index: () => '/moderation', proposals: { index: () => '/moderation/proposals' } } } },
};

const item = (key, type) => ({
    key,
    type,
    priority: 'normal',
    waiting_since: new Date().toISOString(),
    street: key,
    municipality: 'Utrecht',
    flags: {},
});

function queue(rows) {
    const app = mount('queue-list.tsx', queueModules);
    const calls = { open: [], check: [] };
    const props = {
        status: 'open',
        items: { data: rows, total: rows.length, last_page: 1 },
        filters: { types: [], municipality_ids: [], search: null },
        options: {
            types: ['submission', 'report'],
            historyTypes: [],
            municipalities: [],
            can: { submission: true, improvement: true, report: true },
        },
        checked: [],
        decidedToday: 0,
        onCheck: (keys) => calls.check.push([...keys]),
        onOpen: (row) => calls.open.push(row.key),
        onFilter() {},
    };
    const render = () => nodes(app.render(app.exports.QueueList, props));
    const header = () => render().find((node) => node.type?.name === 'QueueHeader');
    const row = (key) => render().find((node) => node.type === 'button' && nodes(node).some((child) => child.props?.children === key));
    return { calls, header, row };
}

test('selecting on a touch screen starts with a button, a tap then selects a row instead of opening it', () => {
    const { calls, header, row } = queue([item('Biltstraat 140', 'submission'), item('Oudegracht 150', 'report')]);
    assert.equal(header().props.selectMode, false);

    header().props.onSelectMode(true);
    row('Biltstraat 140').props.onClick();
    row('Oudegracht 150').props.onClick();

    assert.equal(JSON.stringify(calls.check), '[["Biltstraat 140"]]');
    assert.equal(calls.open.length, 0);
    assert.equal(row('Oudegracht 150').props['aria-disabled'], true);
});

test('leaving selection clears what was selected, and outside it a tap opens the item', () => {
    const { calls, header, row } = queue([item('Biltstraat 140', 'submission')]);
    header().props.onSelectMode(true);
    header().props.onSelectMode(false);
    row('Biltstraat 140').props.onClick();

    assert.equal(JSON.stringify(calls.check), '[[]]');
    assert.equal(JSON.stringify(calls.open), '["Biltstraat 140"]');
});

test('a queue of reports alone offers no selecting, since reports are decided one by one', () => {
    const { header } = queue([item('Oudegracht 150', 'report')]);
    assert.equal(header().props.selectMode, undefined);
});

test('the select button only shows without a mouse, where rows cannot be pointed at', () => {
    const app = mount('queue-list.tsx', queueModules);
    const props = {
        status: 'open',
        total: 1,
        decidedToday: 0,
        filters: { types: [], municipality_ids: [], search: null },
        options: { types: ['submission'], historyTypes: [], municipalities: [], can: { submission: true } },
        onFilter() {},
    };
    const selectButton = (selectMode) =>
        nodes(app.render(app.exports.QueueHeader, { ...props, selectMode })).find((node) =>
            [node.props?.children].flat().some((child) => child === 'queue.select'),
        );

    assert.match(selectButton(false).props.className, /pointer-fine:hidden/);
    assert.equal(selectButton(undefined), undefined);
});

test('the sheet stops at three heights and lets go at the nearest one', () => {
    const { sheetTops, nearestSnap } = mount('workspace.tsx').exports;
    assert.equal(JSON.stringify(sheetTops(800)), '{"peek":544,"half":360,"full":48}');
    assert.equal(nearestSnap(520, 800), 'peek');
    assert.equal(nearestSnap(400, 800), 'half');
    assert.equal(nearestSnap(120, 800), 'full');
    // On a short screen the lowered sheet still leaves the map strip at the top.
    assert.equal(sheetTops(200).peek, 48);
});
