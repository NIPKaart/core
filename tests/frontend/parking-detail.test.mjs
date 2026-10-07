import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const translations = JSON.parse(readFileSync(new URL('../../resources/locales/frontend/en/map/modals.json', import.meta.url), 'utf8'));
const load = (path, requireModule) => {
    const source = ts.transpileModule(readFileSync(new URL(`../../resources/js/components/map/parking-detail/${path}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const context = { exports: {}, require: requireModule };
    vm.runInNewContext(source, context);
    return context.exports;
};
const handoff = load('navigation-handoff.ts', require);
const t = (key, params = {}) => {
    if ('count' in params && key.startsWith('detail.')) key += params.count === 1 ? '_one' : '_other';
    const value = key.split('.').reduce((value, part) => value?.[part], translations) ?? key;
    return Object.entries(params).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)), value);
};
// Stubs for shadcn primitives that rely on Radix portals/path aliases the plain Node require() cannot resolve.
const uiStubs = (name) => {
        if (name === '@/utils/translation') return { translateSourceValue: (_, key, options) => t(key, options) };
    if (name === '@/locale-sync') return { formatLocale: (language) => language === 'en' ? 'en-GB' : language };
    if (name === '@/components/ui/popover') {
        return {
            Popover: ({ children }) => children,
            PopoverTrigger: ({ children }) => children,
            PopoverContent: ({ children }) => children,
        };
    }
    if (name === '@/components/ui/progress') {
        return {
            Progress: (props) =>
                React.createElement('div', {
                    role: 'progressbar',
                    'aria-label': props['aria-label'],
                    'aria-valuetext': props['aria-valuetext'],
                    className: props.className,
                }),
        };
    }
    return require(name);
};
const parts = load('parts.tsx', uiStubs);
const utils = load('utils.tsx', uiStubs);
const Body = load('parking-detail-body.tsx', (name) => {
    if (name === 'react-i18next') return { useTranslation: () => ({ t, i18n: { language: 'en' } }) };
    if (name === './navigation-handoff') return handoff;
    if (name === './parts') return parts;
    if (name === './utils') return utils;
    return uiStubs(name);
}).default;

const place = {
    id: 'abc',
    latitude: 52.1,
    longitude: 4.3,
    country: 'Netherlands',
    province: 'Zuid-Holland',
    municipality: 'Leiden',
    is_favorited: false,
};
const details = {
    community: {
        ...place,
        street: 'Breestraat',
        orientation: { value: 'parallel', label: 'Parallel', description: 'Along the kerb' },
        parking_time: null,
        created_at: '2026-01-02T10:00:00Z',
        updated_at: '2026-02-03T10:00:00Z',
        confirmations_count: { confirmed: 0 },
        last_confirmed_at: null,
        description: null,
        amenity: null,
    },
    municipal: {
        ...place,
        street: null,
        orientation: null,
        rule: null,
        updated_at: '2026-02-03T10:00:00Z',
        provenance: { name: null, attribution: null, url: null, terms_url: null, fetched_at: null, source_updated_at: null },
        confirmations_count: { confirmed: 0 },
        last_confirmed_at: null,
    },
    offstreet: {
        ...place,
        name: 'Garage Centrum',
        type: 'garage',
        free_space: 37,
        capacity: 400,
        url: null,
        prices: null,
        availability: 'current',
        occupancy_status: 'counting',
        observed_at: '2026-02-03T10:00:00Z',
        updated_at: '2026-02-03T10:00:00Z',
    },
};
const render = (source, detail = {}, props = {}) =>
    renderToStaticMarkup(
        React.createElement(Body, { data: { source, detail: { ...details[source], ...detail } }, distanceMetres: null, isLoggedIn: false, ...props }),
    );
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('every source keeps the same group order but only shows the groups that apply to it', () => {
    const expected = {
        // Community and municipal places always show where their parking rules are, or that no source is known.
        community: ['Rules and restrictions', 'Layout', 'Source and freshness'],
        municipal: ['Rules and restrictions', 'Layout', 'Source and freshness'],
        // Garages show their live state in the availability box; signed-out visitors see no source table.
        offstreet: ['Accessibility and availability'],
    };
    for (const source of Object.keys(expected)) {
        const html = render(source);
        const headings = [...html.matchAll(/<h3 id="([^"]+)"[^>]*>([^<]+)<\/h3>/g)];
        assert.deepEqual(
            headings.map((match) => match[2]),
            expected[source],
            source,
        );
        for (const [, id] of headings) assert.match(html, new RegExp(`<section aria-labelledby="${id}"`));
        assert.match(text(html), /Check the signs; no rights can be derived from this\./);
    }
    assert.match(text(render('community')), /Source Community contribution/);
    assert.match(text(render('community')), /Sub-sign Unknown/);
    assert.match(
        text(
            render('community', {
                under_sign: { value: 'yes', label: 'Yes', description: '' },
                under_sign_text: 'Mon-Fri 9-18',
                restriction_days: ['mon', 'fri'],
                restriction_starts_at: '09:00',
                restriction_ends_at: '18:00',
            }),
        ),
        /Sub-sign Yes “Mon-Fri 9-18” Applies on Mon, Fri · 09:00–18:00/,
    );
    assert.match(
        text(render('municipal', { rule: { url: 'https://www.haarlem.nl/regels', scope: 'municipality', name: 'Haarlem', host: 'haarlem.nl' } })),
        /Parking rules Municipality of Haarlem \(opens in a new tab\) Official source · haarlem\.nl Layout/,
    );
    assert.match(
        text(
            render('municipal', {
                rule: { url: 'https://www.rijksoverheid.nl/regels', scope: 'country', name: 'Netherlands', host: 'rijksoverheid.nl' },
            }),
        ),
        /Parking rules National rules \(opens in a new tab\) Official source · rijksoverheid\.nl/,
    );
    assert.match(text(render('municipal')), /Parking rules Unknown Layout/);
    const garage = text(render('offstreet', { url: 'https://example.test/garage' }));
    assert.match(garage, /Rules and restrictions Rates and opening hours Website/);
    assert.doesNotMatch(garage, /Parking rules/);
});

test('distance to the destination is formatted in metres or kilometres', () => {
    assert.equal(utils.formatDistance(0, 'en'), '0 m');
    assert.equal(utils.formatDistance(349.6, 'en'), '350 m');
    assert.equal(utils.formatDistance(1234, 'en'), '1.2 km');
});

test('street parking omits fields its source never provides and marks missing known fields as unknown', () => {
    const municipal = text(render('municipal'));
    assert.doesNotMatch(municipal, /Max\. parking time|availability|Source date/i);
    assert.match(municipal, /Orientation Unknown/);
    assert.match(municipal, /Fetched on Unknown/);
    assert.doesNotMatch(municipal, /This is when the data was fetched/);
    assert.match(municipal, /Leiden, Zuid-Holland, Netherlands/);
    assert.match(text(render('municipal', { municipality: null, province: null, country: ' ' })), /Parking location without an address/);
    assert.match(
        text(render('municipal', { provenance: { ...details.municipal.provenance, source_updated_at: '2026-03-04T00:00:00Z' } })),
        /Source date 4 Mar 2026/,
    );

    const community = text(render('community'));
    assert.doesNotMatch(community, /Max\. parking time|Unlimited|availability/i);
    assert.match(text(render('community', { parking_time: 90 })), /1 hour &amp; 30 minutes Don&#x27;t forget your parking disc!/);
});

test('garage occupancy is labelled as general and accessible spaces are not claimed', () => {
    const live = text(render('offstreet'));
    assert.match(live, /Live Measured/);
    assert.match(live, /General spaces free 37 of 400 free/);
    assert.doesNotMatch(live, /Accessible|long-term|Orientation|Layout/i);
    assert.doesNotMatch(live, /Source and freshness|Live data|may be delayed/);
    assert.match(live, /Navigate/);
    assert.doesNotMatch(live, /Streetview/);
    // European day-month order with a 24-hour clock, also in English.
    assert.match(live, /Measured \d{1,2} Feb 2026, \d{2}:00/);
    assert.doesNotMatch(live, /AM|PM/);

    const failed = text(render('offstreet', { availability: 'unavailable' }));
    assert.doesNotMatch(failed, /37 of 400|General spaces free/);
    assert.match(failed, /Live data unavailable/);
});

test('garage occupancy is only shown for a current measurement', () => {
    const stale = text(render('offstreet', { availability: 'stale' }));
    assert.doesNotMatch(stale, /37 of 400|General spaces free/);
    assert.match(stale, /No recent measurement Measured/);

    const unknown = text(render('offstreet', { availability: 'unknown', observed_at: null }));
    assert.doesNotMatch(unknown, /37 of 400|Measured/);
    assert.match(unknown, /No live data/);
});

test('closed is not full and status-only sites show their status without counts', () => {
    const closed = text(render('offstreet', { availability: 'closed', occupancy_status: null, free_space: null }));
    assert.match(closed, /Closed/);
    assert.doesNotMatch(closed, /Full|0 of 400/);

    const full = text(render('offstreet', { occupancy_status: 'full', free_space: null }));
    assert.match(full, /Full/);
    assert.doesNotMatch(full, /General spaces free/);
    assert.match(text(render('offstreet', { occupancy_status: 'open', free_space: null })), /Spaces available/);
});

test('more free spaces than capacity show the count without a misleading percentage', () => {
    const html = render('offstreet', { free_space: 537, capacity: 410 });
    assert.match(text(html), /General spaces free 537 free/);
    assert.doesNotMatch(text(html), /537 of 410/);
    assert.doesNotMatch(html, /role="progressbar"/);
});

test('navigation hands off the authoritative coordinates via Google Maps and Streetview', () => {
    const html = render('municipal');
    const navigateUrl = handoff.navigationUrl(52.1, 4.3);
    const streetViewUrl = handoff.streetViewUrl(52.1, 4.3);
    assert.match(decodeURIComponent(navigateUrl), /52\.100000,4\.300000/);
    assert.match(decodeURIComponent(streetViewUrl), /52\.100000,4\.300000/);
    assert.ok(html.includes(navigateUrl.replaceAll('&', '&amp;')));
    assert.ok(html.includes(streetViewUrl.replaceAll('&', '&amp;')));
    assert.doesNotMatch(text(html), /Coordinates|52\.100000/);
    assert.equal((html.match(/opens in a new tab/g) ?? []).length, 2);

    assert.equal(handoff.navigationUrl(Number.NaN, 4), null);
    assert.equal(handoff.navigationUrl(91, 4), null);
    assert.match(text(render('community', { latitude: null })), /navigation is unavailable/);
});

test('the description card is no longer duplicated inside the body (it moved to its own tab in the shell)', () => {
    assert.doesNotMatch(text(render('community', { description: 'Watch for the low ceiling' })), /Watch for the low ceiling/);
});

test('the existence check sits in the body of street places only, and signed-in details stay where relevant', () => {
    const existence = React.createElement('p', null, 'existence-check');
    assert.match(render('community', {}, { existence }), /existence-check/);
    assert.match(render('municipal', {}, { existence }), /existence-check/);
    assert.doesNotMatch(render('offstreet', {}, { existence }), /existence-check/);
    assert.doesNotMatch(text(render('community')), /reliab|trust|score/i);
    assert.doesNotMatch(render('offstreet'), /Location ID/);
    assert.match(text(render('offstreet', {}, { isLoggedIn: true })), /Location ID abc/);
    const longId = '41a88722-92fa-4156-a0f9-89d55b6b6ffb';
    const idHtml = render('municipal', { id: longId }, { isLoggedIn: true });
    assert.match(text(idHtml), /Location ID … ending in 5b6b6ffb/);
    assert.match(idHtml, new RegExp(`title="${longId}"`));
});

test('municipal source shows the municipality and keeps dataset details as background', () => {
    const provenance = { ...details.municipal.provenance, name: 'Leiden algemene gehandicaptenparkeerplaatsen', url: 'https://example.test/data' };
    const html = text(render('municipal', { provenance }));
    assert.match(html, /Source Municipality of Leiden/);
    assert.match(text(render('municipal', { municipality: null, provenance })), /Source Leiden algemene gehandicaptenparkeerplaatsen/);
});

test('the detail illustrates the bay orientation widely, a garage for garages, and a generic car when unknown', () => {
    assert.match(render('community'), /src="\/assets\/images\/orientation\/parallel-wide\.svg"/);
    assert.match(render('municipal'), /src="\/assets\/images\/car-illu\.svg"/);
    assert.match(render('offstreet'), /src="\/assets\/images\/garage\.svg"/);
});

/** Loads one detail component with light stand-ins for the UI kit, routes and Inertia. */
const loadComponent = (file) => {
    const compiled = ts.transpileModule(readFileSync(new URL(`../../resources/js/components/map/parking-detail/${file}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const context = {
        exports: {},
        require: (name) => {
        if (name === '@/locale-sync') return { formatLocale: (language) => language === 'en' ? 'en-GB' : language };
            if (name === 'react-i18next') return { useTranslation: () => ({ t, i18n: { language: 'en' } }) };
            if (name === './utils') return utils;
            if (name === '@/routes/map/places/improve')
                return { default: { create: ({ parking_space }) => `/map/places/community/${parking_space}/improve` } };
            if (name === '@/routes/map/places')
                return {
                    confirm: ({ source, id }) => `/map/places/${source}/${id}/confirm`,
                    report: ({ source, id }) => `/map/places/${source}/${id}/report`,
                };
            if (name === '@/components/ui/button')
                return { Button: ({ asChild, children, ...props }) => (asChild ? children : React.createElement('button', props, children)) };
            if (name === '@/components/ui/textarea') return { Textarea: (props) => React.createElement('textarea', props) };
            if (name === '@inertiajs/react') {
                return {
                    Form: ({ children, action }) => React.createElement('form', { action }, children({ errors: {}, processing: false })),
                    Link: ({ children, ...props }) => React.createElement('a', props, children),
                };
            }
            return require(name);
        },
    };
    vm.runInNewContext(compiled, context);
    return context.exports.default;
};

test('the existence check asks one question when signed in and shows the outcome afterwards', () => {
    const ExistenceCheck = loadComponent('existence-check.tsx');
    const html = (props = {}) =>
        renderToStaticMarkup(
            React.createElement(ExistenceCheck, {
                source: 'municipal',
                id: '42',
                confirmedCount: 3,
                lastConfirmedAt: '2026-03-04T09:00:00Z',
                confirmedToday: false,
                reported: false,
                signedIn: true,
                loginHref: '/login?return=%2Fmap',
                onReport: () => {},
                ...props,
            }),
        );

    assert.match(text(html()), /Is the parking space still here\? Confirmed 3× · 4 Mar/);
    assert.match(html(), /<form action="\/map\/places\/municipal\/42\/confirm"/);
    assert.match(html(), /aria-label="Yes, the parking space is here"/);
    assert.match(html(), /aria-label="No, the parking space is gone"/);
    assert.match(text(html({ confirmedCount: 0, lastConfirmedAt: null })), /Is the parking space still here\? Not confirmed yet/);

    assert.match(text(html({ confirmedToday: true })), /Thanks, you confirmed Confirmed 3× · today also by you/);
    assert.match(text(html({ reported: true })), /You reported that the parking space is gone A moderator will look at it\./);
    for (const state of [{ confirmedToday: true }, { reported: true }]) assert.doesNotMatch(html(state), /<form|<button/);
});

test('signed-out visitors see only the evidence and a quiet hint to log in', () => {
    const ExistenceCheck = loadComponent('existence-check.tsx');
    const guest = renderToStaticMarkup(
        React.createElement(ExistenceCheck, {
            source: 'community',
            id: 'abc',
            confirmedCount: 3,
            lastConfirmedAt: '2026-03-04T09:00:00Z',
            confirmedToday: false,
            reported: false,
            signedIn: false,
            loginHref: '/login?return=%2Fmap',
            onReport: () => {},
        }),
    );

    assert.match(text(guest), /Confirmed 3× Present, last on 4 Mar Log in to confirm or report\./);
    assert.match(guest, /<a href="\/login\?return=%2Fmap"[^>]*>Log in<\/a>/);
    assert.doesNotMatch(guest, /<form|<button|Is the parking space still here/);
});

test('the report step keeps the place on the map and asks only optional questions', () => {
    const ReportStep = loadComponent('report-step.tsx');
    const html = renderToStaticMarkup(React.createElement(ReportStep, { source: 'community', id: 'abc', onBack: () => {}, onReported: () => {} }));

    assert.match(html, /<form action="\/map\/places\/community\/abc\/report"/);
    assert.match(text(html), /The parking space is no longer there/);
    assert.match(text(html), /Until then the parking space stays on the map\./);
    assert.match(html, /aria-label="Back to the parking space"/);
    for (const reason of ['sign_removed', 'now_regular_bay', 'other']) assert.match(html, new RegExp(`name="reason" value="${reason}"`));
    assert.doesNotMatch(html, /\schecked[\s=/>]|\srequired[\s=/>]/);
    assert.match(html, /name="note"[^>]*maxLength="500"|maxLength="500"[^>]*name="note"/);
});

test('the contributions tab shows evidence and sources to everyone and actions only to signed-in users', () => {
    const Contributions = loadComponent('contributions.tsx');
    const html = (source, detail = {}, props = {}) =>
        renderToStaticMarkup(
            React.createElement(Contributions, {
                data: {
                    source,
                    detail: { ...details[source], confirmations_count: { confirmed: 2 }, last_confirmed_at: '2026-03-04T09:00:00Z', ...detail },
                },
                signedIn: true,
                loginHref: '/login?return=%2Fmap',
                onReport: () => {},
                ...props,
            }),
        );

    assert.match(text(html('community')), /Does the parking space exist\? Confirmed 2× · last 4 Mar/);
    assert.match(text(html('community')), /Report that the parking space is gone/);
    assert.match(text(html('community')), /Community contribution added 2 Jan/);
    assert.match(text(html('municipal')), /Municipality of Leiden/);
    assert.doesNotMatch(text(html('community')), /Your activity/);

    const active = text(html('municipal', { confirmed_today: true, reported_by_you: true }));
    assert.match(active, /Your activity Confirmed today Reported as gone · awaiting a moderator/);
    assert.doesNotMatch(active, /Report that the parking space is gone/);

    assert.match(html('community'), /href="\/map\/places\/community\/[^"]+\/improve"/);
    assert.doesNotMatch(text(html('municipal')), /Improve information/);
    const pending = text(html('community', { improvement_pending: true }));
    assert.match(pending, /Your activity Improvement proposed · awaiting a moderator/);
    assert.doesNotMatch(pending, /Improve information/);

    const guest = html('community', { confirmed_today: true }, { signedIn: false });
    assert.doesNotMatch(text(guest), /Report that the parking space is gone|Improve information|Your activity/);
    assert.match(text(guest), /Log in to confirm or report\./);
});
