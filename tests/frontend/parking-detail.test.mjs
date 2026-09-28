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
        rule_url: null,
        updated_at: '2026-02-03T10:00:00Z',
        provenance: { name: null, attribution: null, url: null, terms_url: null, fetched_at: null, source_updated_at: null },
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
        community: ['Layout', 'Source and freshness'],
        municipal: ['Layout', 'Source and freshness'],
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
        assert.match(text(html), /Always check the signs on location\. Parking here is not guaranteed\./);
    }
    assert.match(text(render('community')), /Source Community contribution/);
    assert.match(
        text(render('municipal', { rule_url: 'https://example.test/rules' })),
        /Rules and restrictions Municipal regulations Local parking rules/,
    );
    assert.match(text(render('offstreet', { url: 'https://example.test/garage' })), /Rules and restrictions Rates and opening hours Website/);
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
    assert.match(municipal, /Data fetched on Unknown/);
    assert.doesNotMatch(municipal, /This is when the data was fetched/);
    assert.match(municipal, /Leiden, Zuid-Holland, Netherlands/);
    assert.match(text(render('municipal', { municipality: null, province: null, country: ' ' })), /Parking location without an address/);
    assert.match(
        text(render('municipal', { provenance: { ...details.municipal.provenance, source_updated_at: '2026-03-04T00:00:00Z' } })),
        /Source date 4 Mar 2026/,
    );

    const community = text(render('community'));
    assert.doesNotMatch(community, /Max\. parking time|Unlimited|availability/i);
    assert.match(community, /Not confirmed yet/);
    assert.match(community, /Confirmed 0 times by the community/);
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

test('community actions and signed-in details appear only where relevant', () => {
    const actions = React.createElement('p', null, 'confirm-form');
    assert.match(render('community', {}, { communityActions: actions }), /confirm-form/);
    assert.doesNotMatch(render('municipal', {}, { communityActions: actions }), /confirm-form/);
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
