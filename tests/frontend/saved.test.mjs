import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = (file) => ts.transpileModule(readFileSync(new URL(`../../resources/js/${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
        const match = find(child, predicate);
        if (match) return match;
    }
    return null;
}
function mount({ desktop = true, mapContext } = {}) {
    let tab = 'destinations', closed = 0, focused = 0;
    const visits = [];
    const filters = { exports: {} };
    vm.runInNewContext(compile('lib/discovery-filters.ts'), filters);
    const context = {
        exports: {}, URL, window: { location: { origin: 'https://example.test' } },
        require: (name) => {
            if (name === 'react') return { useRef: () => ({ current: false }), useState: () => [tab, (value) => { tab = value; }] };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === '@inertiajs/react') return { router: { visit: (...args) => visits.push(args) } };
            if (name === '@/hooks/use-media-query') return { useMediaQuery: () => desktop };
            if (name === '@/lib/saved-places') {
                const library = { exports: {}, URL, window: context.window, require: context.require };
                vm.runInNewContext(compile('lib/saved-places.ts'), library);
                return library.exports;
            }
            if (name === '@/lib/discovery-filters') return filters.exports;
            if (name === '@/routes') return { locationMap: { url: ({ query } = {}) => '/map' + (query ? '?' + new URLSearchParams(query) : '') } };
            if (name.startsWith('@/components/ui/')) return new Proxy({}, { get: (_, key) => key });
            if (name.startsWith('@/components/map/')) return { default: name, __esModule: true };
            return require(name);
        },
    };
    vm.runInNewContext(compile('components/modals/modal-saved.tsx'), context);
    return { visits, closed: () => closed, focused: () => focused, render: () => context.exports.default({ open: true, onClose: () => { closed++; }, onReturnFocus: () => { focused++; }, mapContext }) };
}
const destination = { key: 'geoapify:1', label: 'Museumstraat', type: 'street', latitude: 52.36, longitude: 4.88 };
const favorite = { favorite_id: 10, id: 'same-id', type: 'Municipal', title: 'Museumstraat', latitude: 52.36, longitude: 4.88, available: true };
for (const desktop of [true, false]) {
    test(`${desktop ? 'desktop dialog' : 'mobile drawer'} groups destinations and favorites and only activates the selected list`, () => {
        const view = mount({ desktop });
        let tree = view.render();
        assert.equal(tree.type, desktop ? 'Dialog' : 'Drawer');
        assert.ok(find(tree, (node) => node.type === 'TabsTrigger' && node.props.value === 'destinations'));
        assert.ok(find(tree, (node) => node.type === 'TabsTrigger' && node.props.value === 'favorites'));
        assert.equal(find(tree, (node) => node.type === '@/components/map/destinations').props.open, true);
        assert.equal(find(tree, (node) => node.type === '@/components/map/favorites').props.open, false);
        find(tree, (node) => node.type === 'Tabs').props.onValueChange('favorites');
        tree = view.render();
        assert.equal(find(tree, (node) => node.type === '@/components/map/destinations').props.open, false);
        assert.equal(find(tree, (node) => node.type === '@/components/map/favorites').props.open, true);
        tree.props.onOpenChange(false);
        assert.equal(view.closed(), 1);
        find(tree, (node) => node.type === (desktop ? 'DialogContent' : 'DrawerContent')).props.onCloseAutoFocus({ preventDefault() {} });
        assert.equal(view.focused(), 1);
    });
}

test('opening either kind on the map closes Saved and invokes its own map interaction', () => {
    const destinations = [], places = [];
    const view = mount({ mapContext: { destination, onDestinationSelect: (value) => destinations.push(value), onFavoriteSelect: (value) => places.push(value) } });
    const tree = view.render();
    const list = find(tree, (node) => node.type === '@/components/map/destinations');
    assert.equal(list.props.destination, destination);
    list.props.onSelect(destination);
    find(tree, (node) => node.type === '@/components/map/favorites').props.onSelect(favorite);
    assert.equal(destinations[0], destination);
    assert.equal(places[0].key, 'municipal:same-id');
    assert.equal(places[0].source, 'municipal');
    assert.equal(view.closed(), 2);
    assert.equal(view.visits.length, 0);
    find(tree, (node) => node.type === 'DialogContent').props.onCloseAutoFocus({ preventDefault() {} });
    assert.equal(view.focused(), 0);
});

test('outside the map, destinations reopen discovery and favorites reopen source-qualified details', () => {
    const view = mount();
    const tree = view.render();
    const destinations = find(tree, (node) => node.type === '@/components/map/destinations');
    assert.equal(destinations.props.destination, null);
    destinations.props.onSelect(destination);
    const url = new URL(view.visits[0][0], 'https://example.test');
    assert.equal(url.pathname, '/map');
    assert.equal(url.searchParams.get('destination'), 'Museumstraat');
    assert.equal(url.searchParams.get('lat'), '52.36');
    assert.equal(view.visits[0][1].preserveState, false);
    find(tree, (node) => node.type === '@/components/map/favorites').props.onSelect(favorite);
    const place = new URL(view.visits[1][0], 'https://example.test');
    assert.equal(place.searchParams.get('place'), 'municipal:same-id');
    assert.equal(place.searchParams.get('at'), '52.36,4.88');
});

test('unavailable or unidentified favorites do not close Saved or navigate', () => {
    const view = mount();
    const choose = find(view.render(), (node) => node.type === '@/components/map/favorites').props.onSelect;
    choose({ ...favorite, available: false });
    choose({ ...favorite, latitude: null });
    choose({ ...favorite, type: 'Unknown' });
    assert.equal(view.closed(), 0);
    assert.equal(view.visits.length, 0);
});

function mountFavorites(fetch) {
    const state = [];
    let cursor = 0, effect;
    const selected = [];
    const context = {
        exports: {}, fetch, AbortController,
        require: (name) => {
            if (name === 'react') return {
                useEffect: (callback) => { effect = callback; },
                useState: (initial) => {
                    const key = cursor++;
                    if (!(key in state)) state[key] = initial;
                    return [state[key], (next) => { state[key] = typeof next === 'function' ? next(state[key]) : next; }];
                },
            };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === '@/routes/profile') return { __esModule: true, default: { favorites: { list: { url: () => '/favorites' } } } };
            if (name.startsWith('@/components/')) return new Proxy({}, { get: (_, key) => key });
            return require(name);
        },
    };
    vm.runInNewContext(compile('components/map/favorites.tsx'), context);
    return {
        selected,
        render: (open = true) => { cursor = 0; return context.exports.default({ open, onSelect: (value) => selected.push(value) }); },
        load: async () => { const cleanup = effect(); await new Promise(setImmediate); return cleanup; },
    };
}

test('favorites load only when active, and selecting a row preserves its source identity', async () => {
    const requests = [];
    const view = mountFavorites(async (url) => { requests.push(url); return { ok: true, json: async () => ({ favorites: [favorite] }) }; });
    view.render(false);
    await view.load();
    assert.equal(requests.length, 0);
    view.render();
    await view.load();
    find(view.render(), (node) => node.type === 'button').props.onClick();
    assert.equal(view.selected[0], favorite);
});

test('favorites loading failures expose retry without claiming the list is empty', async () => {
    let failed = true;
    const view = mountFavorites(async () => ({ ok: !failed, json: async () => ({ favorites: [] }) }));
    view.render();
    await view.load();
    const tree = view.render();
    assert.equal(tree.props.role, 'alert');
    assert.ok(find(tree, (node) => node.type === 'p' && node.props.children === 'load_error'));
    find(tree, (node) => node.type === 'Button').props.onClick();
    failed = false;
    view.render();
    await view.load();
    assert.ok(find(view.render(), (node) => node.props.children === 'empty.title'));
});
