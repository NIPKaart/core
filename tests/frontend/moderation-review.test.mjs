import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const transpile = (path) =>
    ts.transpileModule(readFileSync(new URL(`../../resources/js/pages/backend/moderation/${path}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;

/** Any import that only supplies components or icons: each name becomes a tag the test can look for. */
const tags = new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : String(key)) });
/** Route helpers: every property is callable and turns into a URL string. */
const routes = () => new Proxy(() => '/url', { get: (_, key) => (key === '__esModule' ? false : routes()), apply: () => '/url' });

function load(path, modules) {
    const context = {
        exports: {},
        JSON,
        Math,
        require: (name) => {
            if (name in modules) return modules[name];
            if (name === 'react/jsx-runtime') {
                const jsx = (type, props, key) => ({ type, props, key });
                return { jsx, jsxs: jsx, Fragment: 'Fragment' };
            }
            if (name === 'react')
                return {
                    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
                    useMemo: (build) => build(),
                    useRef: (value) => ({ current: value }),
                    useEffect: () => {},
                };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key, i18n: { language: 'nl' } }) };
            if (name === '@/routes' || name === '@/routes/app') return { default: routes(), locationMap: routes() };
            if (name === '@inertiajs/react') return { router: { post: () => {} } };
            if (name === '@/hooks/use-initials') return { useInitials: () => () => 'IN' };
            if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
            if (name.startsWith('date-fns')) return require(name);
            return tags;
        },
    };
    vm.runInNewContext(transpile(path), context);
    return context.exports;
}

const values = load('values.ts', {});
const geo = load('geo.ts', {});
const pane = load('review-pane.tsx', {
    './values': values,
    './geo': geo,
    './parts': { useAgo: () => () => '8 dagen geleden' },
    './shortcuts': { Kbd: 'Kbd', useShortcuts: () => {} },
});

/** Renders a component element one level, as React would call it. */
const render = (element) => element.type(element.props);

function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children, node.props?.header, node.props?.body, node.props?.actions].flat(Infinity)) {
        const match = find(child, predicate);
        if (match) return match;
    }
    return null;
}

const current = {
    latitude: 52.0925,
    longitude: 5.1355,
    street: 'Biltstraat',
    municipality: 'Utrecht',
    orientation: 'perpendicular',
    under_sign: false,
    under_sign_text: null,
    parking_time: null,
    restriction_days: [],
    restriction_starts_at: null,
    restriction_ends_at: null,
    description: null,
};
const options = {
    can: { submission: true, improvement: true, report: true },
    reasons: { submission: [], improvement: [], report: [] },
    orientations: [],
    underSign: [],
    restrictionDays: [],
};
const selected = {
    key: 'submission:1',
    type: 'submission',
    priority: 'normal',
    waiting_since: '2026-10-20T10:00:00Z',
    route: { parking_space: '1' },
    street: 'Biltstraat 140',
    municipality: 'Utrecht',
    latitude: current.latitude,
    longitude: current.longitude,
    contributor: null,
    flags: {},
    details: {
        space: { id: '1', street: 'Biltstraat 140', municipality: 'Utrecht' },
        current,
        nearbySpaces: [],
        nearbyMunicipalSpaces: [],
        nearestMunicipal: null,
    },
};

test('an open submission shows its decision and details while no reason form is open', () => {
    const review = render(
        pane.ReviewPane({
            selected,
            position: { index: 5, total: 180, previous: null, next: null },
            loading: null,
            options,
            query: {},
            onNavigate: () => {},
            onBack: () => {},
        }),
    );
    // The review passes `false` for a closed form; the panel must still show the item.
    assert.equal(review.props.decision, false);
    const panel = render(review);

    assert.ok(
        find(panel, (node) => node.props?.shortcut === 'A'),
        'approve button',
    );
    assert.ok(
        find(panel, (node) => node.props?.shortcut === 'R'),
        'reject button',
    );
    assert.ok(
        find(panel, (node) => node.props?.title === 'review.submitted'),
        'submitted details',
    );

    // The decision closes the panel, below the details, and nothing follows it.
    const content = [panel.props.children].flat(Infinity).filter(Boolean).at(-1);
    const sections = [content.props.children].flat(Infinity).filter(Boolean);
    const last = sections.at(-1);
    assert.ok(find(last, (node) => node.props?.shortcut === 'A') && find(last, (node) => node.props?.shortcut === 'R'), 'buttons last');
    assert.ok(
        find(sections[0], (node) => node.props?.title === 'review.submitted'),
        'details first',
    );
    assert.equal(sections.length, 2);

    // The details read as on the public map: the orientation with its illustration, then the other details.
    assert.ok(
        find(panel, (node) => node.type === 'OrientationCard'),
        'orientation card',
    );
    const details = find(panel, (node) => node.type === 'DetailRows');
    // Rows come from another vm context, so compare their keys as text.
    assert.equal(details.props.rows.map((row) => row.key).join(','), 'location,under_sign,description');
});
