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

test('the drawer shows three heights and keeps a strip of map above it when fully open', () => {
    const { sheetHeights, sheetSnapPoints } = mount('workspace.tsx').exports;
    assert.equal(JSON.stringify(sheetHeights(800)), '{"peek":256,"half":440,"full":752}');
    // The drawer is as tall as fully open and slides down, so each snap point adds the strip of map above it.
    assert.equal(JSON.stringify(sheetSnapPoints(800)), '{"peek":"304px","half":"488px","full":"800px"}');
    // On a short screen the lowered drawer is never taller than fully open.
    assert.equal(sheetHeights(200).peek, 152);
});

test('the panel is a drawer that stays open beside the map, and only lays out the part that shows', () => {
    const app = mount('workspace.tsx');
    const chosen = [];
    const tree = app.render(app.exports.MobileSheet, {
        container: {},
        height: 800,
        snaps: ['peek', 'half', 'full'],
        snap: 'half',
        onSnap: (snap) => chosen.push(snap),
        label: 'Wachtrij',
        children: 'panel',
    });
    const all = nodes(tree);
    const drawer = all.find((node) => node.type === 'Drawer');
    const content = all.find((node) => node.type === 'DrawerContent');

    assert.equal(drawer.props.modal, false);
    assert.equal(drawer.props.dismissible, false);
    assert.equal(drawer.props.activeSnapPoint, '488px');
    drawer.props.setActiveSnapPoint('304px');
    assert.deepEqual(chosen, ['peek']);
    // A region keeps the map and the moderation shortcuts in use, unlike a dialog.
    assert.equal(content.props.role, 'region');
    assert.equal(content.props.handle, false);
    assert.equal(content.props.style.height, 752);
    assert.equal(all.find((node) => node.props?.style?.height === 440)?.type, 'div');
});
