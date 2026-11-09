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

function editor(reported_bays = null) {
    const states = [];
    const requests = [];
    const storage = new Map();
    const point = { id: 15, latitude: 52.011, longitude: 4.36, last_seen: null };
    const proposal = { id: 23, points: [point], status: 'open', source: 'NDW', street: 'Delft', reported_bays };
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
        '@/routes/app': {
            default: {
                moderation: {
                    proposals: {
                        publish: { url: (id) => `/moderation/proposals/${id}/publish` },
                        reject: { url: (id) => `/moderation/proposals/${id}/reject` },
                    },
                },
            },
        },
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
                options: {
                    orientations: [],
                    restrictionDays: [],
                    maxBays: 20,
                    completionReasons: [{ value: 'not_visible', label: 'Not visible' }],
                    rejectionReasons: [{ value: 'duplicate', label: 'Already exists' }],
                },
                revision: 0,
                canReject: true,
                community: [
                    { ...point, id: 'existing-space', street: 'Oude Kerkstraat' },
                    { ...point, id: 'other-space', longitude: 4.3602, street: 'Oude Kerkstraat' },
                ],
                municipal: [
                    { ...point, latitude: 52.0111, id: 'existing-space', street: 'Markt' },
                    { ...point, latitude: 52.0112, id: 'other-municipal', street: null },
                ],
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

test('shows nearby parking from both sources before entering duplicate selection', () => {
    const map = element(editor().render(), 'Workspace').props.map;

    assert.equal(map.nearby.length, 2);
    assert.equal(map.municipal.length, 2);
});

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

test('a partial completion sends a reason without saving it in the local draft', () => {
    const screen = editor(2);
    element(screen.render(), 'Workspace').props.map.onPlace({ latitude: 52.011, longitude: 4.36 });
    action(screen.render(), 'proposals.to_details').props.onClick();
    element(screen.render(), 'DetailsStep').props.setData('orientation', 'parallel');
    element(screen.render(), 'DetailsStep').props.setData('under_sign', 'no');
    action(screen.render(), 'proposals.check').props.onClick();
    assert.equal(action(screen.render(), 'proposals.complete_with').props.disabled, true);
    find(screen.render(), (node) => node.type === 'input' && node.props.name === 'proposal-reason').props.onChange();
    action(screen.render(), 'proposals.complete_with').props.onClick();
    assert.equal(screen.requests[0].data.reason, 'not_visible');
    assert.ok(![...screen.storage.values()][0].includes('not_visible'));
});

for (const [source, field] of [
    ['community', 'existing_parking_space_id'],
    ['municipal', 'existing_parking_municipal_id'],
]) {
    test(`duplicate rejection can select a ${source} space on the map`, () => {
        const screen = editor();
        action(screen.render(), 'proposals.reject_title').props.onClick();
        find(screen.render(), (node) => node.type === 'input' && node.props.name === 'proposal-reason').props.onChange();
        const view = screen.render();
        assert.equal(action(view, 'proposals.match_same').props.disabled, true);
        element(view, 'Workspace').props.map.onPick(`${source}:existing-space`);
        action(screen.render(), 'proposals.match_same').props.onClick();
        assert.equal(screen.requests[0].url, '/moderation/proposals/23/reject');
        assert.equal(screen.requests[0].data[field], 'existing-space');
        const otherField = source === 'municipal' ? 'existing_parking_space_id' : 'existing_parking_municipal_id';
        assert.equal(screen.requests[0].data[otherField], null);
    });
}

test('compares a candidate and sends an uncertain assessment without a close decision', () => {
    const screen = editor();
    action(screen.render(), 'proposals.review_match').props.onClick();
    element(screen.render(), 'Workspace').props.map.onPick('municipal:existing-space');
    action(screen.render(), 'proposals.match_unclear').props.onClick();
    assert.equal(screen.requests[0].data.match_outcome, 'unclear');
    assert.equal(screen.requests[0].data.existing_parking_municipal_id, 'existing-space');
});

test('a decided proposal links to its bays on the map, or to the existing space it duplicates', () => {
    const jsx = (type, props) => ({ type, props });
    const tags = new Proxy({}, { get: (_, name) => String(name) });
    const modules = {
        'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
        react: { useEffect() {}, useState: (initial) => [initial, () => {}] },
        'react-i18next': { useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) },
        './parts': { useAgo: () => () => '5 minutes ago' },
        './values': { useValueFormatter: () => () => '' },
    };
    const context = { exports: {}, require: (name) => modules[name] ?? tags };
    vm.runInNewContext(compiled('decided.tsx'), context);
    const row = {
        key: 'proposal:1',
        type: 'proposal',
        decision: 'completed',
        street: 'Oude Kerkstraat 2',
        municipality: 'Delft',
        reviewer: 'Moderator',
        reason: 'Not visible',
        latitude: 52.011,
        longitude: 4.36,
        proposal: { source: 'NDW', total_bays: 1, reported_bays: 2, bays: [{ id: 'bay', number: 1, url: '/map?place=community:bay' }] },
    };
    const { DecisionPane, DecisionLabel } = context.exports;

    const label = DecisionLabel({ row });
    assert.ok(find(label, (node) => node.props.children === 'history.proposal_partial'));
    assert.match(find(label, (node) => node.props.children === row.reason).props.className, /\bblock\b/);

    assert.equal(element(DecisionPane({ row, options: {} }), 'a').props.href, '/map?place=community:bay');
    const rejected = { ...row, decision: 'rejected', proposal: { ...row.proposal, bays: [], existing_url: '/map?place=community:existing' } };
    assert.equal(element(DecisionPane({ row: rejected, options: {} }), 'a').props.href, '/map?place=community:existing');
});
