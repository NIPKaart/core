import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const tags = new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : String(key)) });
function mount(file, modules = {}) {
    const state = [];
    let cursor = 0;
    const visits = [];
    const route = Object.assign(() => '/admin/imports/1', { url: () => '/admin/imports/1', form: () => ({}) });
    const context = {
        exports: {},
        require: (name) => {
            if (name in modules) return modules[name];
            if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
            if (name === 'react')
                return {
                    useState: (initial) => {
                        const index = cursor++;
                        if (!(index in state)) state[index] = initial;
                        return [
                            state[index],
                            (value) => {
                                state[index] = typeof value === 'function' ? value(state[index]) : value;
                            },
                        ];
                    },
                    useRef: (value) => ({ current: value }),
                    useMemo: (build) => build(),
                    useEffect: () => {},
                };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key, i18n: { language: 'nl' } }) };
            if (name === '@inertiajs/react') return { Form: 'Form', Link: 'Link', Head: 'Head', router: { get: (...args) => visits.push(args) } };
            if (name === '@/actions/App/Http/Controllers/Admin/DatasetImportController') return { show: route, index: route, update: route };
            if (name === 'leaflet') return { divIcon: (options) => options };
            if (name === '@/lib/pin-svg') return { pinSvg: () => '<svg />' };
            if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
            if (name === '@/utils/translation') return { translateSourceValue: (_, key) => key };
            return tags;
        },
    };
    vm.runInNewContext(
        ts.transpileModule(readFileSync(new URL(`../../resources/js/pages/backend/imports/${file}`, import.meta.url), 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
        context,
    );
    return {
        state,
        exports: context.exports,
        visits,
        render: (component, props) => {
            cursor = 0;
            return component(props);
        },
    };
}
function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
        const found = find(child, predicate);
        if (found) return found;
    }
    return null;
}
const row = (id) => ({
    external_id: id,
    after: { street: 'Teststraat' },
    before: null,
    status: 'new',
    fields: [],
    conflicts: [],
    geometry_review_required: true,
});

function reviewPage() {
    const app = mount('show.tsx');
    const props = {
        import: { id: 1, state: 'pending' },
        dataset: { id: 1, name: 'Amsterdam', target_type: 'municipal' },
        municipalityName: 'Amsterdam',
        review: {
            rows: [row('a')],
            token: 'first',
            geometry_ids: ['a', 'b'],
            derivations: 2,
            counts: { new: 2 },
            blockers: [],
            identity_count: 0,
            map_points: [],
        },
        page: 1,
        pages: 1,
        total: 1,
        filters: { q: '', filter: 'geometry' },
        times: {},
    };
    const render = () => app.render(app.exports.default, props);
    const form = () => find(render(), (node) => node.type === 'Form' && typeof node.props.children === 'function');
    const decision = () => form().props.children({ errors: {}, processing: false });
    return { app, props, render, decision };
}

test('publication stays disabled until every required geometry is checked and explicitly confirmed', () => {
    const page = reviewPage();
    const publish = () => find(page.decision(), (node) => node.props?.value === 'publish');
    assert.equal(publish().props.disabled, true);
    find(page.render(), (node) => node.type === 'DeliveryOverview').props.onStart('geometry');
    let workspace = find(page.render(), (node) => node.type === 'ReviewWorkspace');
    workspace.props.onReviewed('a');
    workspace.props.onReviewed('a');
    assert.equal(publish().props.disabled, true);
    workspace = find(page.render(), (node) => node.type === 'ReviewWorkspace');
    workspace.props.onReviewed('b');
    const checkbox = find(page.decision(), (node) => node.props?.name === 'geometry_reviewed');
    assert.equal(checkbox.props.disabled, false, JSON.stringify(page.app.state));
    assert.equal(publish().props.disabled, true);
    checkbox.props.onCheckedChange(true);
    assert.equal(publish().props.disabled, false);
    page.props.review = { ...page.props.review, token: 'changed' };
    assert.equal(publish().props.disabled, true);
    assert.equal(find(page.decision(), (node) => node.props?.name === 'geometry_reviewed').props.checked, false);
});

test('blockers prevent publication but still allow rejecting the delivery', () => {
    const page = reviewPage();
    page.props.review = { ...page.props.review, derivations: 0, geometry_ids: [], blockers: ['Unresolved identity'] };
    assert.equal(find(page.decision(), (node) => node.props?.value === 'publish').props.disabled, true);
    assert.equal(find(page.decision(), (node) => node.props?.value === 'reject').props.disabled, false);
});

test('checking the last geometry on a page records it and opens the next page with the same filter', () => {
    const app = mount('review-workspace.tsx', { './source-record': { claimTitle: (claim) => claim?.street, claimCapacity: () => null } });
    const checked = [];
    let finished = 0;
    const props = {
        rows: [row('a')],
        delivery: { id: 1, state: 'pending' },
        token: 'first',
        filter: 'geometry',
        reviewedIds: [],
        onReviewed: (id) => checked.push(id),
        onFinish: () => finished++,
        page: 1,
        pages: 2,
        total: 26,
        query: '',
    };
    const tree = app.render(app.exports.ReviewWorkspace, props);
    assert.equal(finished, 0);
    assert.equal(app.visits.length, 0);
    find(tree, (node) => node.type === 'Button' && node.props.children?.includes?.('workspace.check_next')).props.onClick();
    assert.deepEqual(checked, ['a']);
    assert.equal(app.visits[0][1].page, 2);
    assert.equal(app.visits[0][1].filter, 'geometry');
    assert.equal(app.visits[0][2].preserveState, true);
    props.page = 2;
    find(
        app.render(app.exports.ReviewWorkspace, props),
        (node) => node.type === 'Button' && node.props.children?.includes?.('workspace.check_next'),
    ).props.onClick();
    assert.equal(finished, 1);
});

test('published and superseded deliveries offer inspection without geometry review actions', () => {
    const app = mount('review-workspace.tsx', { './source-record': { claimTitle: () => 'Teststraat', claimCapacity: () => 1 } });
    for (const delivery of [{ state: 'published' }, { state: 'pending', superseded: true }]) {
        const tree = app.render(app.exports.ReviewWorkspace, {
            rows: [row('a')],
            delivery,
            reviewedIds: [],
            filter: 'all',
            page: 1,
            pages: 1,
            total: 1,
            onFinish() {},
        });
        assert.equal(
            find(tree, (node) => node.type === 'Button' && node.props.children?.includes?.('workspace.check_next')),
            null,
        );
    }
});

test('incoming and missing records with the same source ID can be inspected separately', () => {
    const app = mount('review-workspace.tsx', { './source-record': { claimTitle: (claim) => claim?.street, claimCapacity: () => 1 } });
    const incoming = row('same-id');
    const missing = { ...row('same-id'), status: 'missing', after: null, before: { street: 'Previous street' }, geometry_review_required: false };
    const props = {
        rows: [incoming, missing],
        delivery: { state: 'pending' },
        reviewedIds: [],
        filter: 'all',
        page: 1,
        pages: 1,
        total: 2,
        onFinish() {},
    };
    let tree = app.render(app.exports.ReviewWorkspace, props);
    find(tree, (node) => node.type === 'Button' && node.props['aria-label'] === 'workspace.to_review').props.onClick();
    tree = app.render(app.exports.ReviewWorkspace, props);
    const queue = find(tree, (node) => node.type === 'nav' && node.props['aria-label'] === 'workspace.queue');
    queue.props.children[1].props.onClick();
    tree = app.render(app.exports.ReviewWorkspace, props);
    assert.equal(find(tree, (node) => node.type === 'h3').props.children, 'Previous street');
    assert.equal(
        find(tree, (node) => node.type === 'Button' && node.props.children?.includes?.('workspace.check_next')),
        null,
    );
});

test('review framing includes the actual marker and selected candidate without zooming out to unrelated candidates', () => {
    const { reviewGeometries } = mount('source-record.ts').exports;
    const source = {
        type: 'Polygon',
        coordinates: [
            [
                [4.8, 52.3],
                [4.81, 52.3],
                [4.8, 52.31],
                [4.8, 52.3],
            ],
        ],
    };
    const proposed = { type: 'Point', coordinates: [4.805, 52.305] };
    const selected = { type: 'Point', coordinates: [4.806, 52.306] };
    const unrelated = { type: 'Point', coordinates: [5.5, 53.0] };
    const record = {
        ...row('a'),
        after: { geometry: source },
        point: { longitude: 4.807, latitude: 52.307 },
        geometry_derivation: { geometry: proposed },
        identity: {
            candidates: [
                { id: 'near', source: { geometry: selected } },
                { id: 'far', source: { geometry: unrelated } },
            ],
        },
    };
    const geometries = reviewGeometries(record, 'near');
    assert.deepEqual(JSON.parse(JSON.stringify(geometries)), [source, proposed, { type: 'Point', coordinates: [4.807, 52.307] }, selected]);
    assert.equal(reviewGeometries(record, '').includes(unrelated), false);
    assert.equal(reviewGeometries(record, '').length, 3);
    assert.deepEqual(JSON.parse(JSON.stringify(reviewGeometries({ ...record, after: null, before: { geometry: source } }, 'near'))), [
        source,
        proposed,
        { type: 'Point', coordinates: [4.807, 52.307] },
        selected,
    ]);
});

test('identity selection submits the real candidate ID and maps the new-location option to an empty ID', () => {
    const app = mount('review-workspace.tsx', { './source-record': mount('source-record.ts').exports });
    const changes = [];
    const props = {
        row: {
            ...row('a'),
            identity: { candidates: [{ id: 'candidate', name: 'Nearby garage', distance_metres: 12, source: { external_id: 'old-id' } }] },
        },
        delivery: { id: 1 },
        token: 'first',
        target: '',
        onTargetChange: (id) => changes.push(id),
    };
    const render = (processing = false) => app.render(app.exports.IdentityDecision, props).props.children({ errors: {}, processing });
    find(render(), (node) => node.type === 'ToggleGroup').props.onValueChange('existing');
    assert.deepEqual(changes, ['candidate']);
    props.target = 'candidate';
    assert.equal(find(render(), (node) => node.props?.name === 'facility_id').props.value, 'candidate');
    assert.ok(find(render(), (node) => node.type === 'td' && node.props.children === 'old-id'));
    assert.ok(find(render(), (node) => node.type === 'td' && node.props.children === 'Nearby garage'));
    assert.ok(find(render(), (node) => node.type === 'td' && node.props.children === 'Teststraat'));
    find(render(), (node) => node.type === 'ToggleGroup').props.onValueChange('new');
    assert.deepEqual(changes, ['candidate', '']);
    assert.equal(find(render(true), (node) => node.type === 'ToggleGroup').props.disabled, true);
});

test('geometry layers can be toggled and map style persists when moving to another record', () => {
    const records = mount('source-record.ts').exports;
    const app = mount('review-workspace.tsx', { './source-record': records });
    const record = {
        ...row('a'),
        point: { longitude: 4.8, latitude: 52.3 },
        after: { geometry: { type: 'Polygon', coordinates: [] } },
        geometry_derivation: { geometry: { type: 'Polygon', coordinates: [] } },
    };
    const props = { row: record, candidateId: '' };
    let tree = app.render(app.exports.ReviewMap, props);
    const toolbar = find(tree, (node) => typeof node.type === 'function' && node.type.name === 'MapToolbar');
    toolbar.props.onStyleChange('satellite');
    find(tree, (node) => node.type === 'ToggleGroup').props.onValueChange(['proposed']);
    props.row = { ...record, external_id: 'b' };
    tree = app.render(app.exports.ReviewMap, props);
    assert.equal(find(tree, (node) => typeof node.type === 'function' && node.type.name === 'MapToolbar').props.style, 'satellite');
    const map = find(tree, (node) => node.type === 'MapContainer');
    assert.equal(map.props.zoomControl, false);
    assert.equal(
        find(tree, (node) => node.type === 'GeoJSON' && node.props.style.dashArray === '6 5'),
        null,
    );
    assert.ok(find(tree, (node) => node.type === 'GeoJSON' && node.props.data === record.geometry_derivation.geometry));
});

test('the review pane switches between a record and its queue without losing the selected record', () => {
    const app = mount('review-workspace.tsx', { './source-record': { claimTitle: (claim) => claim?.street, claimCapacity: () => 1 } });
    const props = {
        rows: [
            { ...row('a'), point: { latitude: 52, longitude: 4 } },
            { ...row('b'), point: { latitude: 53, longitude: 5 } },
        ],
        delivery: { state: 'pending' },
        reviewedIds: [],
        page: 1,
        pages: 1,
        total: 2,
        onFinish() {},
    };
    let tree = app.render(app.exports.ReviewWorkspace, props);
    assert.equal(
        find(tree, (node) => node.type === 'nav' && node.props['aria-label'] === 'workspace.queue'),
        null,
    );
    assert.equal(find(tree, (node) => node.type === app.exports.ReviewMap).props.workspace, true);

    find(tree, (node) => node.type === 'Button' && node.props['aria-label'] === 'workspace.to_review').props.onClick();
    tree = app.render(app.exports.ReviewWorkspace, props);
    const overview = find(tree, (node) => typeof node.type === 'function' && node.type.name === 'OverviewMap');
    assert.equal(overview.props.points.length, 2);
    overview.props.onSelect('new:b');
    tree = app.render(app.exports.ReviewWorkspace, props);
    assert.equal(
        find(tree, (node) => node.type === 'nav' && node.props['aria-label'] === 'workspace.queue'),
        null,
    );
    assert.equal(find(tree, (node) => node.type === app.exports.ReviewMap).props.row.external_id, 'b');
});

function identityWorkspace() {
    const records = mount('source-record.ts').exports;
    const app = mount('review-workspace.tsx', { './source-record': records });
    const identityRow = (id) => ({
        ...row(id),
        geometry_review_required: false,
        identity: {
            method: 'review',
            facility_id: null,
            candidates: [{ id: `candidate-${id}`, name: 'Existing', distance_metres: 0, source: { external_id: `old-${id}` } }],
        },
    });
    let finished = 0;
    const props = {
        rows: [identityRow('a'), identityRow('b')],
        delivery: { id: 1, state: 'pending' },
        token: 'first',
        filter: 'identity',
        reviewedIds: [],
        page: 1,
        pages: 1,
        total: 2,
        query: '',
        summary: { type: 'Summary', props: {} },
        onFinish: () => finished++,
    };
    const render = () => app.render(app.exports.ReviewWorkspace, props);
    const decision = () => find(render(), (node) => node.type === app.exports.IdentityDecision);
    return { app, props, render, decision, finished: () => finished };
}

test('resolved identity decisions allow both remaining geometries to be checked without resubmitting the decisions', () => {
    const workspace = identityWorkspace();
    const checked = [];
    workspace.props.filter = 'geometry';
    workspace.props.onReviewed = (id) => checked.push(id);
    workspace.props.rows = workspace.props.rows.map((record) => ({
        ...record,
        geometry_review_required: true,
        identity: { ...record.identity, method: 'manual', facility_id: record.identity.candidates[0].id },
    }));

    for (const id of ['a', 'b']) {
        const tree = workspace.render();
        assert.equal(workspace.decision(), null);
        assert.equal(find(tree, (node) => node.type === workspace.app.exports.ReviewMap).props.row.external_id, id);
        const check = find(tree, (node) => node.type === 'Button' && node.props.children?.includes?.('workspace.check_next'));
        assert.ok(check);
        check.props.onClick();
    }

    assert.deepEqual(checked, ['a', 'b']);
    assert.equal(workspace.finished(), 1);
    assert.equal(workspace.app.visits.length, 0);
});

test('saving an identity advances to the next remaining record and finishing the queue returns to the whole set', () => {
    const workspace = identityWorkspace();
    const current = workspace.decision();
    assert.equal(current.props.target, 'candidate-a');
    assert.equal(find(workspace.render(), (node) => node.type === 'Button' && node.props.type === 'submit').props.form, current.props.formId);
    assert.ok(find(workspace.render(), (node) => node.type === 'Summary'));
    assert.equal(workspace.finished(), 0);

    current.props.onSaved({ props: { review: { rows: [workspace.props.rows[1]] } } });
    workspace.props.rows = [workspace.props.rows[1]];
    assert.equal(workspace.decision().props.row.external_id, 'b');
    workspace.decision().props.onSaved({ props: { review: { rows: [] } } });
    assert.equal(workspace.finished(), 1);
});

test('saving disables navigation and skip while validation errors keep the same record open', () => {
    const workspace = identityWorkspace();
    const decision = workspace.decision();
    const form = workspace.app.exports.IdentityDecision(decision.props);
    form.props.onStart();
    const tree = workspace.render();
    assert.equal(find(tree, (node) => node.type === 'Button' && node.props.form === decision.props.formId).props.disabled, true);
    assert.equal(find(tree, (node) => node.type === 'Button' && node.props.children === 'workspace.skip').props.disabled, true);
    assert.equal(find(tree, (node) => node.type === 'Button' && node.props['aria-label'] === 'next').props.disabled, true);
    const body = form.props.children({ errors: { reason: 'Required' }, processing: false });
    assert.ok(find(body, (node) => node.props?.message === 'Required'));
    assert.equal(
        find(body, (node) => node.type === 'Button' && node.props.type === 'submit'),
        null,
    );
    form.props.onFinish();
    assert.equal(workspace.decision().props.row.external_id, 'a');
    assert.equal(workspace.finished(), 0);
    find(workspace.render(), (node) => node.type === workspace.app.exports.ReviewMap).props.onOverview();
    assert.equal(workspace.finished(), 1);
});

test('skipping an uncertain link changes selection without saving or marking it reviewed', () => {
    const workspace = identityWorkspace();
    find(workspace.render(), (node) => node.type === 'Button' && node.props.children === 'workspace.skip').props.onClick();
    assert.equal(workspace.decision().props.row.external_id, 'b');
    assert.equal(workspace.app.visits.length, 0);
    assert.deepEqual(workspace.props.reviewedIds, []);
});

test('overview change groups open only populated status queues', () => {
    const app = mount('review-workspace.tsx');
    const opened = [];
    const tree = app.render(app.exports.DeliveryOverview, {
        delivery: { state: 'pending' },
        points: [],
        derivations: 0,
        identities: 0,
        recordCount: 12,
        completed: 0,
        counts: { new: 8, changed: 3, missing: 1, conflict: 0 },
        onStart: (filter) => opened.push(filter),
    });
    for (const status of ['new', 'changed', 'missing']) {
        find(
            tree,
            (node) => node.type === 'Button' && find(node, (child) => child.type === 'span' && child.props.children === `counts.${status}`),
        ).props.onClick();
    }
    assert.deepEqual(opened, ['new', 'changed', 'missing']);
    assert.equal(
        find(tree, (node) => node.type === 'span' && node.props.children === 'counts.conflict'),
        null,
    );
});

test('the delivery overview and full map remain available while a review filter is loading', () => {
    const page = reviewPage();
    find(page.render(), (node) => node.type === 'DeliveryOverview').props.onStart('identity');
    const options = page.app.visits[0][2];
    options.onStart();
    assert.equal(find(page.render(), (node) => node.type === 'DeliveryOverview').props.loading, true);
    assert.equal(
        find(page.render(), (node) => node.type === 'ReviewWorkspace'),
        null,
    );
    options.onFinish();
    assert.ok(find(page.render(), (node) => node.type === 'ReviewWorkspace'));
});
