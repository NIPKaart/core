import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/map/destinations.tsx', import.meta.url), 'utf8'), {
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
const destination = { key: 'url:destination', label: 'Museumstraat, Amsterdam', sub: 'Amsterdam', type: 'street', latitude: 52.36, longitude: 4.88 };
const item = { id: 7, label: 'Office', destination };
function mount({ user = { id: 1 }, failure = false, items = [item] } = {}) {
    const instances = new Map();
    let active, cursor, opened = false, effects = [];
    const requests = [], selected = [];
    const context = {
        exports: {}, AbortController,
        fetch: async (url) => { requests.push({ method: 'get', url }); return { ok: true, json: async () => ({ data: items }) }; },
        require: (name) => {
            if (name === 'react') return {
                useId: () => 'label',
                useEffect: (effect) => effects.push(effect),
                useState: (initial) => {
                    const key = cursor++;
                    if (!(key in active)) active[key] = initial;
                    const state = active;
                    return [state[key], (next) => { state[key] = typeof next === 'function' ? next(state[key]) : next; }];
                },
            };
            if (name === '@inertiajs/react') return {
                usePage: () => ({ props: { auth: { user } } }),
                useHttp: (initial) => {
                    const key = cursor++;
                    if (!active[key]) active[key] = { data: initial, processing: false, errors: {} };
                    const form = active[key];
                    form.setData = (field, value) => { form.data[field] = value; };
                    form.transform = (callback) => { form.transformData = callback; };
                    for (const method of ['post', 'patch', 'delete']) form[method] = async (url) => {
                        requests.push({ method, url, data: form.transformData ? form.transformData(form.data) : form.data });
                        if (failure) throw new Error('offline');
                    };
                    return form;
                },
            };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name.startsWith('@/components/ui/')) return new Proxy({}, { get: (_, key) => key });
            if (name === '@/routes/profile/destinations') return Object.fromEntries(['list', 'store', 'update', 'destroy'].map((key) => [key, { url: (id) => `/destinations/${key}/${id ?? ''}` }]));
            return require(name);
        },
    };
    vm.runInNewContext(source, context);
    const render = (component = context.exports.default, props = { open: opened, destination, onSelect: (value) => selected.push(value) }) => {
        if (!instances.has(component)) instances.set(component, []);
        active = instances.get(component); cursor = 0; effects = [];
        return component(props);
    };
    return { render, requests, selected, open: () => { opened = true; }, effects: async () => { for (const effect of effects) effect(); await new Promise(setImmediate); } };
}
function open(view) {
    view.open();
    view.render();
    return view.effects();
}
function form(view) {
    find(view.render(), (node) => node.type === 'Button' && node.props.children === 'save_current').props.onClick();
    return find(view.render(), (node) => node.type?.name === 'DestinationForm');
}

test('guests have no personal destination controls or requests', () => {
    const view = mount({ user: null });
    assert.equal(view.render(), null);
    assert.equal(view.requests.length, 0);
});

test('saving is explicit and sends identity plus the edited personal label without parking filters', async () => {
    const view = mount();
    await open(view);
    assert.equal(view.requests.filter((request) => request.method === 'post').length, 0);
    const node = form(view);
    const tree = view.render(node.type, node.props);
    find(tree, (node) => node.type === 'Input').props.onChange({ target: { value: 'Hospital' } });
    await tree.props.onSubmit({ preventDefault() {} });
    const request = view.requests.at(-1);
    assert.equal(request.method, 'post');
    assert.deepEqual(JSON.parse(JSON.stringify(request.data)), { label: 'Hospital', key: destination.key, name: destination.label, sub: destination.sub, type: destination.type, latitude: 52.36, longitude: 4.88 });
});

test('opening a saved destination passes its original identity to discovery', async () => {
    const view = mount();
    await open(view);
    const row = find(view.render(), (node) => node.type?.name === 'DestinationRow');
    const tree = view.render(row.type, row.props);
    find(tree, (node) => node.type === 'Button' && !node.props['aria-label']).props.onClick();
    assert.equal(view.selected[0], destination);
    assert.equal(view.requests.length, 1);
});

test('renaming changes only the personal label and removal calls the selected destination', async () => {
    const view = mount();
    await open(view);
    const row = find(view.render(), (node) => node.type?.name === 'DestinationRow');
    find(view.render(row.type, row.props), (node) => node.props['aria-label'] === 'rename').props.onClick();
    const editor = find(view.render(row.type, row.props), (node) => node.type?.name === 'DestinationForm');
    const tree = view.render(editor.type, editor.props);
    find(tree, (node) => node.type === 'Input').props.onChange({ target: { value: 'Grandma' } });
    await tree.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(JSON.parse(JSON.stringify(view.requests.at(-1))), { method: 'patch', url: '/destinations/update/7', data: { label: 'Grandma' } });
    await find(view.render(row.type, row.props), (node) => node.props['aria-label'] === 'remove').props.onClick();
    assert.equal(view.requests.at(-1).url, '/destinations/destroy/7');
    assert.equal(view.requests.at(-1).method, 'delete');
});

test('a failed save keeps the editor open and exposes an error', async () => {
    const view = mount({ failure: true });
    await open(view);
    const node = form(view);
    await view.render(node.type, node.props).props.onSubmit({ preventDefault() {} });
    assert.ok(find(view.render(node.type, node.props), (node) => node.props.role === 'alert'));
});

test('reopening on the map resets selection and pagination, keeps session filters and requests current results', () => {
    const state = [];
    let cursor = 0;
    const window = { location: new URL('https://example.test/map?destination=Old&lat=52&lng=5&radius=500&source=municipal&sort=distance'), history: {
        state: {}, replaceState: (_state, _title, path) => { window.location = new URL(path, window.location); },
    } };
    const loadLibrary = (name) => {
        const context = { exports: {} };
        vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../resources/js/lib/${name}.ts`, import.meta.url), 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS },
        }).outputText, context);
        return context.exports;
    };
    const context = {
        exports: {}, window, URL, URLSearchParams,
        require: (name) => {
            if (name === 'react') return {
                useEffect() {}, useRef: () => ({ current: null }), useMemo: (fn) => fn(), useCallback: (fn) => fn,
                useState: (initial) => {
                    const key = cursor++;
                    if (!(key in state)) state[key] = typeof initial === 'function' ? initial() : initial;
                    return [state[key], (next) => { state[key] = typeof next === 'function' ? next(state[key]) : next; }];
                },
            };
            if (name === '@inertiajs/react') return { usePage: () => ({ url: window.location.pathname + window.location.search }), Head: 'Head' };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === '@/components/search/search-store') return { useSearchOpen: () => false };
            if (name === '@/lib/discovery-filters') return loadLibrary('discovery-filters');
            if (name === '@/lib/place-link') return loadLibrary('place-link');
            if (name === '@/lib/destination-icon') return {};
            if (name === 'react/jsx-runtime') return require(name);
            if (name.startsWith('@/') || name === 'react-leaflet') return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : `${name}:${String(key)}` });
            throw new Error(name);
        },
    };
    const mapSource = readFileSync(new URL('../../resources/js/pages/frontend/map/index.tsx', import.meta.url), 'utf8').replace('import.meta.env.VITE_MAPBOX_ACCESS_TOKEN', "'token'");
    vm.runInNewContext(ts.transpileModule(mapSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
    const render = () => { cursor = 0; return context.exports.default(); };
    const nearby = (tree) => find(tree, (node) => node.type === '@/components/map/nearby-discovery:default');
    const tree = render();
    nearby(tree).props.onResults([{ key: 'old', latitude: 52, longitude: 5 }]);
    nearby(tree).props.onStatus('ready');
    nearby(tree).props.onHasMore(true);
    find(render(), (node) => node.type === '@/components/ui/button:Button' && node.props.children === 'results.next').props.onClick();
    assert.equal(nearby(render()).props.page, 2);
    render().props.savedMapContext.onDestinationSelect(destination);
    const reopened = render();
    assert.equal(nearby(reopened).props.origin, destination);
    assert.equal(nearby(reopened).props.page, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(nearby(reopened).props.filters)), { source: 'municipal', radius: 500, sort: 'distance' });
    assert.equal(find(reopened, (node) => node.type === '@/components/map/parking-map-layer:default').props.results.length, 0);
    assert.equal(find(reopened, (node) => node.type === '@/components/map/parking-detail/parking-detail:default').props.open, false);
    assert.equal(window.location.searchParams.get('destination'), 'Museumstraat, Amsterdam');
});


test('an empty destination list shows an icon, title and guidance after loading', async () => {
    const view = mount({ items: [] });
    assert.equal(find(view.render(), (node) => node.props.children === 'empty.title'), null);
    await open(view);
    const tree = view.render();
    const title = find(tree, (node) => node.props.children === 'empty.title');
    assert.ok(title);
    assert.ok(find(tree, (node) => node.props.children === 'empty.description'));
    assert.ok(find(tree, (node) => node.props['aria-hidden'] && node.props.className?.includes('size-10')));
    assert.equal(find(tree, (node) => node.type === 'ul'), null);
});
