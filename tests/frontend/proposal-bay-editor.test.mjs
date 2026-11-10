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
    const proposal = { id: 23, points: [point], status: 'open', source: 'NDW', street: 'Delft · #23', municipality: 'Delft' };
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
        '@inertiajs/react': { Link: 'Link', router: { post: (url, data, options) => requests.push({ url, data, options }) } },
        'react-i18next': { useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) },
        '@/routes/app': {
            default: {
                moderation: {
                    proposals: {
                        publish: { url: (id) => `/moderation/proposals/${id}/publish` },
                        reject: { url: (id) => `/moderation/proposals/${id}/reject` },
                        reopen: { url: (id) => `/moderation/proposals/${id}/reopen` },
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
        render({ published = false, publishedBays = [], close = true, decision = null, nextUrl, proposalPins, onPickProposal, parking, onBack = () => {} } = {}) {
            hook = 0;
            return context.exports.LocationProposalReview({
                selection: { proposal: { ...proposal, status: published ? 'added' : 'open' }, point },
                imagery: [],
                options: {
                    orientations: [],
                    restrictionDays: [],
                    maxBays: 20,
                    rejectionReasons: [{ value: 'duplicate', label: 'Already exists' }],
                },
                revision: 0,
                canReject: true,
                community: [
                    { ...point, id: 'existing-space', street: 'Oude Kerkstraat', possible_duplicate: close, distance_metres: close ? 2 : 92 },
                    { ...point, id: 'other-space', longitude: 4.3602, street: 'Oude Kerkstraat', possible_duplicate: false, distance_metres: 92 },
                ],
                municipal: [
                    {
                        ...point,
                        latitude: 52.0111,
                        id: 'existing-space',
                        street: 'Markt',
                        possible_duplicate: close,
                        distance_metres: close ? 2.5 : 92,
                    },
                    { ...point, latitude: 52.0112, id: 'other-municipal', street: null, possible_duplicate: false, distance_metres: 92 },
                ],
                query: {},
                publishedBays,
                decision,
                nextUrl,
                proposalPins,
                onPickProposal,
                parking,
                onBack,
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

test('opens the proposal at aerial zoom with the municipality parking as map context', () => {
    const parking = {
        community: [{ latitude: 52.02, longitude: 4.4 }],
        municipal: [{ latitude: 52.02, longitude: 4.39 }],
    };
    const workspace = element(editor().render({ parking }), 'Workspace').props;

    assert.equal(workspace.initialLayer, 'satellite');
    assert.equal(workspace.map.zoom, 19);
    assert.equal(workspace.map.nearby, parking.community);
    assert.equal(workspace.map.municipal, parking.municipal);
});

test('keeps other proposals selectable while adding distinct bays on the same map', () => {
    const screen = editor();
    const proposalPins = [{ key: '16', point: { latitude: 52.012, longitude: 4.36 }, color: 'blue' }];
    const picks = [];
    const render = () => screen.render({ proposalPins, onPickProposal: (...args) => picks.push(args) });
    const first = { latitude: 52.011, longitude: 4.36 };
    const second = { latitude: 52.01125, longitude: 4.36025 };
    element(render(), 'Workspace').props.map.onPlace(first);
    element(render(), 'Workspace').props.map.onPlace(second);

    const view = render();
    const map = element(view, 'Workspace').props.map;
    assert.equal(map.queue, proposalPins);
    assert.equal(map.bays.length, 2);
    assert.notEqual(map.bays[0].key, map.bays[1].key);
    assert.equal(find(view, (node) => node.props?.children === 'proposals.standalone.title'), undefined);
    map.onPick('16');
    assert.deepEqual(picks, [['16']]);
    assert.equal(screen.requests.length, 0);
    assert.equal(screen.storage.size, 1);
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

for (const [source, field] of [
    ['community', 'existing_parking_space_id'],
    ['municipal', 'existing_parking_municipal_id'],
]) {
    test(`duplicate rejection can select a ${source} space on the map`, () => {
        const screen = editor();
        action(screen.render(), 'proposals.review_proposal').props.onClick();
        element(screen.render(), 'RadioGroup').props.onChange('duplicate');
        const view = screen.render();
        assert.equal(action(view, 'proposals.close_duplicate').props.disabled, true);
        element(view, 'Workspace').props.map.onPick(`${source}:existing-space`);
        action(screen.render(), 'proposals.close_duplicate').props.onClick();
        assert.equal(screen.requests[0].url, '/moderation/proposals/23/reject');
        assert.equal(screen.requests[0].data[field], 'existing-space');
        const otherField = source === 'municipal' ? 'existing_parking_space_id' : 'existing_parking_municipal_id';
        assert.equal(screen.requests[0].data[otherField], null);
    });
}

test('arrives with the municipality as title and a hint on the map', () => {
    const view = editor().render();
    assert.ok(find(view, (node) => node.type === 'h2' && node.props.children === 'Delft'));
    assert.equal(element(view, 'Workspace').props.mapHint, 'proposals.map_hint');
    assert.equal(
        find(view, (node) => node.props.children === 'proposals.next_proposal'),
        undefined,
    );
});

test('removes a bay while placing, but only checks bays in the last step', () => {
    const screen = editor();
    element(screen.render(), 'Workspace').props.map.onPlace({ latitude: 52.011, longitude: 4.36 });
    let view = screen.render();
    assert.equal(element(view, 'Workspace').props.mapHint, undefined);
    assert.equal(typeof element(view, 'Workspace').props.map.onRemoveBay, 'function');
    assert.ok(find(view, (node) => node.props?.['aria-label'] === 'proposals.remove'));

    action(view, 'proposals.to_details').props.onClick();
    element(screen.render(), 'DetailsStep').props.setData('orientation', 'parallel');
    element(screen.render(), 'DetailsStep').props.setData('under_sign', 'no');
    action(screen.render(), 'proposals.check').props.onClick();
    view = screen.render();
    assert.equal(
        find(view, (node) => node.props?.['aria-label'] === 'proposals.remove'),
        undefined,
    );
    assert.ok(find(view, (node) => node.props?.['aria-label'] === 'proposals.street_view'));
});

test('removing a selected concept bay from the map only persists the remaining bay', () => {
    const screen = editor();
    const map = () => element(screen.render(), 'Workspace').props.map;
    map().onPlace({ latitude: 52.011, longitude: 4.36 });
    map().onPlace({ latitude: 52.012, longitude: 4.36 });
    const [first, second] = map().bays;
    assert.equal(second.state, 'selected');

    map().onRemoveBay(second.key);

    assert.deepEqual(
        Array.from(map().bays, (bay) => bay.key),
        [first.key],
    );
    const [saved] = screen.storage.values();
    assert.deepEqual(
        JSON.parse(saved).bays.map((bay) => bay.id),
        [first.key],
    );
    assert.ok(find(screen.render(), (node) => node.props?.['aria-label'] === 'proposals.remove'));
});

test('after publishing, the footer leads on to the next proposal, or back to the queue when none is left', () => {
    const screen = editor();
    const publishedBays = [{ latitude: 52.011, longitude: 4.36, number: 1 }];
    const withNext = screen.render({ published: true, publishedBays, nextUrl: '/moderation/proposals?after=23' });
    assert.ok(find(withNext, (node) => node.type === 'Link' && node.props.href === '/moderation/proposals?after=23'));
    assert.equal(
        find(withNext, (node) => node.type === 'Button' && node.props.children === 'proposals.back_to_queue'),
        undefined,
    );

    action(screen.render({ published: true, publishedBays }), 'proposals.back_to_queue');
});

test('a duplicate further than 3 m away can still be chosen when closing the proposal', () => {
    const screen = editor();
    action(screen.render({ close: false }), 'proposals.review_proposal').props.onClick();
    element(screen.render({ close: false }), 'RadioGroup').props.onChange('duplicate');
    element(screen.render({ close: false }), 'Workspace').props.map.onPick('community:other-space');
    action(screen.render({ close: false }), 'proposals.close_duplicate').props.onClick();
    assert.equal(screen.requests[0].data.existing_parking_space_id, 'other-space');
    assert.equal('match_outcome' in screen.requests[0].data, false);
});

test('a proposal closed as a duplicate shows the existing space and can be reopened', () => {
    const screen = editor();
    const decision = {
        reason: 'duplicate',
        reasonLabel: 'Already exists',
        decidedAt: '2026-11-09T10:00:00+00:00',
        moderator: 'Moderator',
        existing: { source: 'municipal', street: 'Markt', distance_metres: 2.5, url: '/map?place=municipal:existing-space' },
    };
    const view = screen.render({ published: true, decision });
    const card = find(view, (node) => node.type?.name === 'ClosedCard');
    assert.equal(card.props.decision.existing.url, '/map?place=municipal:existing-space');
    action(view, 'proposals.reopen').props.onClick();
    assert.equal(screen.requests[0].url, '/moderation/proposals/23/reopen');
    assert.deepEqual({ ...screen.requests[0].data }, { revision: 0 });
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
        proposal: { source: 'NDW', total_bays: 1, bays: [{ id: 'bay', number: 1, url: '/map?place=community:bay' }] },
    };
    const { DecisionPane, DecisionLabel } = context.exports;

    const label = DecisionLabel({ row });
    assert.ok(find(label, (node) => node.props.children === 'history.proposal_added'));
    assert.match(find(label, (node) => node.props.children === row.reason).props.className, /\bblock\b/);

    assert.equal(element(DecisionPane({ row, options: {} }), 'a').props.href, '/map?place=community:bay');
    const rejected = { ...row, decision: 'rejected', proposal: { ...row.proposal, bays: [], existing_url: '/map?place=community:existing' } };
    assert.equal(element(DecisionPane({ row: rejected, options: {} }), 'a').props.href, '/map?place=community:existing');
});

test('duplicate comparison keeps the detail view and synchronizes the list with the selected pin', () => {
    const screen = editor();
    const before = element(screen.render(), 'Workspace').props.map;
    action(screen.render(), 'proposals.review_proposal').props.onClick();
    element(screen.render(), 'RadioGroup').props.onChange('duplicate');

    const view = screen.render();
    const map = element(view, 'Workspace').props.map;
    assert.equal(map.fitQueue, false);
    assert.equal(map.center, before.center);
    assert.equal(map.zoom, before.zoom);
    assert.equal(map.sourcePoint, before.sourcePoint);

    const candidateList = (tree) => find(tree, (node) => node.props['aria-labelledby'] === 'proposal-duplicate-label');
    candidateList(view).props.onChange('municipal:existing-space');
    const selected = element(screen.render(), 'Workspace').props.map;
    assert.equal(selected.highlighted, 'municipal:existing-space');
    assert.equal(selected.inspectedPin.latitude, 52.0111);
    assert.equal(selected.center, before.center);
    assert.equal(selected.zoom, before.zoom);

    selected.onPick('community:existing-space');
    assert.equal(candidateList(screen.render()).props.value, 'community:existing-space');
});

test('reviewing later leaves the proposal open and goes to the next proposal or back to the queue', () => {
    const screen = editor();
    action(screen.render(), 'proposals.review_proposal').props.onClick();
    element(screen.render(), 'RadioGroup').props.onChange('later');

    const nextUrl = '/moderation/proposals?after=23';
    const view = screen.render({ nextUrl });
    assert.equal(element(view, 'Link').props.href, nextUrl);
    assert.equal(element(view, 'Link').props.children, 'proposals.review_later');

    let returned = false;
    action(screen.render({ onBack: () => (returned = true) }), 'proposals.review_later').props.onClick();
    assert.equal(returned, true);
    assert.equal(screen.requests.length, 0);
});
