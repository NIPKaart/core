import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(
    readFileSync(new URL('../../resources/js/pages/backend/moderation/proposal-bay-editor.tsx', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function find(node, predicate) {
    if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
    if (!node?.props) return undefined;
    return predicate(node) ? node : find(node.props.children, predicate);
}

function editor() {
    const states = [];
    const requests = [];
    const source = { id: 15, latitude: 52.011, longitude: 4.36, external_id: 'evidence-id' };
    let hook = 0;
    let data;
    let defaults;
    let processing = false;
    let errors = {};
    const jsx = (type, props) => ({ type, props });
    const props = {
        proposal: 23,
        points: [source],
        published: false,
        publishedBays: [],
        orientations: [],
        restrictionDays: [],
        maxBays: 20,
        query: { municipality: 8 },
    };
    const modules = {
        'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
        react: {
            useState(initial) {
                const index = hook++;
                if (!(index in states)) states[index] = initial;
                return [
                    states[index],
                    (next) => {
                        states[index] = next;
                    },
                ];
            },
        },
        '@inertiajs/react': {
            useForm(initial) {
                defaults ??= initial;
                data ??= initial;
                return {
                    data,
                    processing,
                    errors,
                    setData(key, value) {
                        data = typeof key === 'function' ? key(data) : { ...data, [key]: value };
                    },
                    post(url, options) {
                        requests.push({ url, data, options });
                    },
                    reset() {
                        data = defaults;
                    },
                };
            },
        },
        'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
        '@/routes/app': { default: { moderation: { proposals: { publish: { url: (id) => `/moderation/proposals/${id}/publish` } } } } },
        '@/components/contribute/details-step': { default: 'DetailsStep' },
        '@/components/contribute/review-step': { ContributionDetailsSummary: 'ContributionDetailsSummary' },
        '@/components/map/parking-detail/navigation-handoff': { streetViewUrl: () => 'https://example.test/streetview' },
        './moderation-map': { ModerationMap: 'ModerationMap' },
    };
    const tags = new Proxy({}, { get: (_, name) => String(name) });
    const context = { exports: {}, require: (name) => modules[name] ?? tags };
    vm.runInNewContext(compiled, context);
    return {
        render(next) {
            hook = 0;
            return context.exports.ProposalBayEditor({ ...props, ...next });
        },
        requests,
        failure(message) {
            errors = { 'bays.1.latitude': message };
        },
        processing(value) {
            processing = value;
        },
    };
}

const element = (tree, type) => {
    const match = find(tree, (node) => node.type === type);
    assert.ok(match, type);
    return match;
};
const action = (tree, key) => {
    const match = find(tree, (node) => node.type === 'Button' && node.props.children === key);
    assert.ok(match, key);
    return match;
};

test('publishes all drawn bays in one request and preserves the batch on a validation error', () => {
    const screen = editor();
    let view = screen.render();
    assert.equal(action(view, 'proposals.steps.details').props.disabled, true);

    action(view, 'proposals.add_at_source').props.onClick();
    element(screen.render(), 'ModerationMap').props.onMove({ latitude: 52.01101, longitude: 4.36001 });
    element(screen.render(), 'ModerationMap').props.onMove({ latitude: 52.01102, longitude: 4.36002 });
    action(screen.render(), 'proposals.steps.details').props.onClick();

    view = screen.render();
    assert.equal(action(view, 'proposals.steps.check').props.disabled, true);
    element(view, 'DetailsStep').props.setData('orientation', 'parallel');
    element(screen.render(), 'DetailsStep').props.setData('under_sign', 'no');
    action(screen.render(), 'proposals.steps.check').props.onClick();

    const event = { preventDefault() {} };
    view = screen.render();
    element(view, 'ContributionDetailsSummary');
    element(view, 'form').props.onSubmit(event);
    assert.equal(screen.requests.length, 1);
    const [request] = screen.requests;
    assert.equal(request.url, '/moderation/proposals/23/publish');
    assert.equal(request.data.orientation, 'parallel');
    assert.equal(request.data.under_sign, 'no');
    assert.deepEqual(JSON.parse(JSON.stringify(request.data.bays)), [
        { latitude: 52.011, longitude: 4.36, source_point_id: 15 },
        { latitude: 52.01101, longitude: 4.36001, source_point_id: 15 },
        { latitude: 52.01102, longitude: 4.36002, source_point_id: 15 },
    ]);

    screen.processing(true);
    element(screen.render(), 'form').props.onSubmit(event);
    assert.equal(screen.requests.length, 1);

    screen.processing(false);
    screen.failure('Move the second bay');
    view = screen.render();
    assert.ok(find(view, (node) => node.props.role === 'alert'));
    assert.equal(element(view, 'ModerationMap').props.numbered.length, 3);
    element(view, 'form').props.onSubmit(event);
    assert.equal(screen.requests.length, 2);
    assert.equal(screen.requests[1].data, request.data);

    request.options.onSuccess();
    view = screen.render({ published: true, publishedBays: request.data.bays });
    assert.ok(find(view, (node) => node.props.role === 'status' && node.props.children === 'proposals.added_count'));
    assert.equal(element(view, 'ModerationMap').props.publishedBays.length, 3);
    assert.equal(element(view, 'ModerationMap').props.onMove, undefined);
    assert.equal(
        find(view, (node) => node.type === 'form'),
        undefined,
    );
});
