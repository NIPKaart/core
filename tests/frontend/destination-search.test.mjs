import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/map/destination-search.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
        const result = find(child, predicate);
        if (result) return result;
    }
    return null;
}
function mount() {
    let index = 0, open = true, requested, focused = false;
    const state = [], selected = [];
    let destination = { key: 'station', label: 'Amsterdam Centraal', latitude: 52.38, longitude: 4.9 };
    const context = { exports: {}, document: { getElementById: () => ({ focus: () => { focused = true; } }) }, require: name => {
        if (name === 'react') return { useEffect: () => {}, useRef: () => ({ current: null }), useState: initial => {
            const key = index++;
            if (!(key in state)) state[key] = initial;
            return [state[key], next => { state[key] = next; }];
        } };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: key => key }) };
        if (name === '@/components/search/search-store') return { useSearchOpen: () => open, closeSearch: () => { open = false; }, openSearch: () => { open = true; } };
        if (name === '@/hooks/use-media-query') return { useMediaQuery: () => false };
        if (name === '@/hooks/use-search-hotkey') return { useSearchHotkey() {} };
        if (name === '@/hooks/use-search-recent') return { useRecentSearches: () => ({ items: ['Amsterdam Centraal', 'Amsterdam'], add() {} }) };
        if (name === '@/hooks/use-destination-suggestions') return { useDestinationSuggestions: (query, active) => {
            requested = { query, active };
            return { results: active && destination ? [destination] : [], status: active ? 'ready' : 'idle' };
        } };
        if (name === '@/routes/destinations') return {};
        if (name.startsWith('@/components/ui/')) return new Proxy({}, { get: (_, key) => key });
        return require(name);
    } };
    vm.runInNewContext(source, context);
    return { selected, requested: () => requested, focused: () => focused, render: () => { index = 0; return context.exports.default({ destination, onClear: () => { destination = null; selected.push(null); }, onSelect: next => selected.push(next) }); } };
}
test('reopening the selected destination shows recent searches without requesting the same destination again', () => {
    const view = mount();
    const tree = view.render();
    assert.equal(view.requested().active, false);
    assert.ok(find(tree, node => node.type === 'CommandGroup' && node.props.heading === 'recent'));
    find(tree, node => node.type === 'CommandInput').props.onValueChange('Amsterdam');
    view.render();
    assert.deepEqual(view.requested(), { query: 'Amsterdam', active: true });
});
test('choosing a suggestion closes mobile search and returns focus to the navbar toggle', () => {
    const view = mount();
    find(view.render(), node => node.type === 'CommandInput').props.onValueChange('Amsterdam');
    find(view.render(), node => node.type === 'CommandItem' && node.props.value === 'station').props.onSelect();
    assert.equal(view.selected[0].key, 'station');
    assert.equal(view.render().props.hidden, true);
    assert.equal(view.focused(), true);
});
test('Escape cancels mobile search without changing the destination', () => {
    const view = mount();
    find(view.render(), node => node.type === 'Command').props.onKeyDown({ key: 'Escape', preventDefault() {} });
    assert.equal(view.selected.length, 0);
    assert.equal(view.render().props.hidden, true);
    assert.equal(view.focused(), true);
});

test('choosing the current destination from recent searches returns to the map without reloading results', () => {
    const view = mount();
    find(view.render(), node => node.type === 'CommandItem' && node.props.value === 'Amsterdam Centraal').props.onSelect();
    assert.equal(view.selected.length, 0);
    assert.equal(view.render().props.hidden, true);
    assert.equal(view.focused(), true);
});

test('clearing search removes the chosen destination as well as the input', () => {
    const view = mount();
    find(view.render(), node => node.type === 'Button' && node.props['aria-label'] === 'clear').props.onClick();
    assert.deepEqual(view.selected, [null]);
    assert.equal(find(view.render(), node => node.type === 'CommandInput').props.value, '');
    find(view.render(), node => node.type === 'Command').props.onKeyDown({ key: 'Escape', preventDefault() {} });
    assert.equal(find(view.render(), node => node.type === 'CommandInput').props.value, '');
});
