import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function compiled(file) {
    return ts.transpileModule(readFileSync(new URL(`../../resources/js/pages/backend/moderation/${file}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
}

function find(node, predicate) {
    if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
    if (!node?.props) return undefined;
    return predicate(node) ? node : find(node.props.children, predicate);
}

function editor() {
    const states = [];
    const requests = [];
    const storage = new Map();
    const point = { id: 15, latitude: 52.011, longitude: 4.36, last_seen: null };
    const proposal = { id: 23, points: [point], status: 'open', source: 'NDW', street: 'Delft', reported_bays: null };
    let hook = 0;
    let uuid = 0;
    const jsx = (type, props) => ({ type, props });
    const browser = {
        localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: (key) => storage.delete(key),
        },
    };
    const draft = { exports: {}, window: browser };
    vm.runInNewContext(compiled('location-proposal-draft.ts'), draft);

    const modules = {
        'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
        react: {
            useEffect(effect) {
                effect();
            },
            useState(initial) {
                const index = hook++;
                if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
                return [
                    states[index],
                    (next) => {
                        states[index] = typeof next === 'function' ? next(states[index]) : next;
                    },
                ];
            },
        },
        '@inertiajs/react': { router: { post: (url, data, options) => requests.push({ url, data, options }) } },
        'react-i18next': { useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) },
        '@/routes/app': { default: { moderation: { proposals: { publish: { url: (id) => `/moderation/proposals/${id}/publish` } } } } },
        '@/components/contribute/details-step': { default: 'DetailsStep' },
        '@/components/input-error': { default: 'InputError' },
        '@/components/map/parking-detail/navigation-handoff': { streetViewUrl: () => 'https://example.test/streetview' },
        '@/lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') },
        './location-proposal-draft': draft.exports,
        './workspace': { Workspace: 'Workspace', PanelNav: 'PanelNav' },
    };
    const tags = new Proxy({}, { get: (_, name) => String(name) });
    const context = {
        exports: {},
        crypto: { randomUUID: () => String(++uuid) },
        require: (name) => modules[name] ?? tags,
    };
    vm.runInNewContext(compiled('location-proposals.tsx'), context);
    return {
        render({ published = false, publishedBays = [] } = {}) {
            hook = 0;
            return context.exports.LocationProposalReview({
                selection: { proposal: { ...proposal, status: published ? 'added' : 'open' }, point },
                imagery: [],
                options: { orientations: [], restrictionDays: [], maxBays: 20 },
                query: {},
                publishedBays,
                onBack() {},
            });
        },
        requests,
        storage,
    };
}

function element(tree, type) {
    const match = find(tree, (node) => node.type === type);
    assert.ok(match, type);
    return match;
}

function action(tree, key) {
    const match = find(tree, (node) => node.type === 'Button' && (node.props.children === key || node.props.children?.includes?.(key)));
    assert.ok(match, key);
    return match;
}

test('publishes the whole pilot batch and keeps draggable drafts until Core confirms publication', () => {
    const screen = editor();
    let view = screen.render();
    const first = { latitude: 52.011, longitude: 4.36 };
    const second = { latitude: 52.01101, longitude: 4.36001 };
    const third = { latitude: 52.01102, longitude: 4.36002 };
    for (const point of [first, second, third]) {
        element(view, 'Workspace').props.map.onPlace(point);
        view = screen.render();
    }
    assert.equal(element(view, 'Workspace').props.map.bays.length, 3);
    assert.equal(typeof element(view, 'Workspace').props.map.onMoveBay, 'function');
    assert.equal(screen.storage.size, 1);

    action(view, 'proposals.to_details').props.onClick();
    view = screen.render();
    assert.equal(action(view, 'proposals.check').props.disabled, true);
    element(view, 'DetailsStep').props.setData('orientation', 'parallel');
    element(screen.render(), 'DetailsStep').props.setData('under_sign', 'no');
    action(screen.render(), 'proposals.check').props.onClick();

    view = screen.render();
    action(view, 'proposals.publish').props.onClick();
    assert.equal(screen.requests.length, 1);
    const [request] = screen.requests;
    assert.equal(request.url, '/moderation/proposals/23/publish');
    assert.equal(request.data.orientation, 'parallel');
    assert.equal(request.data.under_sign, 'no');
    assert.deepEqual(JSON.parse(JSON.stringify(request.data.bays)), [
        { ...first, source_point_id: 15 },
        { ...second, source_point_id: 15 },
        { ...third, source_point_id: 15 },
    ]);

    assert.equal(action(screen.render(), 'proposals.submitting').props.disabled, true);
    request.options.onError({ 'bays.1.latitude': 'Move the second bay' });
    request.options.onFinish();
    view = screen.render();
    assert.equal(element(view, 'InputError').props.message, 'Move the second bay');
    assert.equal(element(view, 'Workspace').props.map.bays.length, 3);
    action(view, 'proposals.publish').props.onClick();
    assert.equal(screen.requests.length, 2);

    screen.requests[1].options.onSuccess();
    screen.requests[1].options.onFinish();
    view = screen.render({
        published: true,
        publishedBays: request.data.bays.map((bay, index) => ({ ...bay, number: index + 1 })),
    });
    const map = element(view, 'Workspace').props.map;
    assert.equal(map.bays.length, 3);
    assert.ok(map.bays.every((pin) => pin.state === 'submitted'));
    assert.equal(map.onPlace, undefined);
    assert.equal(map.onMoveBay, undefined);
    assert.equal(screen.storage.size, 0);
    action(view, 'proposals.back_to_queue');
});
