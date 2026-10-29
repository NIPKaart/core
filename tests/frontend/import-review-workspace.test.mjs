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
    checkbox.props.onChange({ target: { checked: true } });
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
    find(tree, (node) => node.type === 'Button' && node.props.children?.includes('workspace.check_next')).props.onClick();
    assert.deepEqual(checked, ['a']);
    assert.equal(app.visits[0][1].page, 2);
    assert.equal(app.visits[0][1].filter, 'geometry');
    assert.equal(app.visits[0][2].preserveState, true);
    props.page = 2;
    find(
        app.render(app.exports.ReviewWorkspace, props),
        (node) => node.type === 'Button' && node.props.children?.includes('workspace.check_next'),
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
            find(tree, (node) => node.type === 'Button' && node.props.children?.includes('workspace.check_next')),
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
    const queue = find(tree, (node) => node.type === 'nav' && node.props['aria-label'] === 'workspace.queue');
    queue.props.children[1].props.onClick();
    tree = app.render(app.exports.ReviewWorkspace, props);
    assert.equal(find(tree, (node) => node.type === 'h3').props.children, 'Previous street');
    assert.equal(
        find(tree, (node) => node.type === 'Button' && node.props.children?.includes('workspace.check_next')),
        null,
    );
});
