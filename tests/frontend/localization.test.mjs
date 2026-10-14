import i18next from 'i18next';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const locales = new URL('../../resources/locales/', import.meta.url);
function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
        return entry.isDirectory() ? files(url) : [url];
    });
}
const resources = { en: {}, nl: {} };
for (const file of files(locales)) {
    const [, domain, language, namespace] = file.pathname.match(/locales\/([^/]+)\/(en|nl)\/(.+)\.json$/);
    resources[language][`${domain}/${namespace}`] = JSON.parse(readFileSync(file, 'utf8'));
}
function leaves(value, prefix = '', result = {}) {
    for (const [key, item] of Object.entries(value)) {
        const name = prefix ? `${prefix}.${key}` : key;
        if (typeof item === 'object') leaves(item, name, result);
        else result[name] = item;
    }
    return result;
}
function placeholders(value) {
    return [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((match) => match[1]).sort();
}

test('Dutch and English catalogs cover the same messages and preserve interpolation variables', () => {
    assert.deepEqual(Object.keys(resources.en).sort(), Object.keys(resources.nl).sort());
    for (const [namespace, english] of Object.entries(resources.en)) {
        const en = leaves(english);
        const nl = leaves(resources.nl[namespace]);
        assert.deepEqual(Object.keys(en).sort(), Object.keys(nl).sort(), namespace);
        for (const key of Object.keys(en)) {
            assert.ok(en[key].trim(), `${namespace}:${key} en`);
            assert.ok(nl[key].trim(), `${namespace}:${key} nl`);
            assert.deepEqual(placeholders(en[key]), placeholders(nl[key]), `${namespace}:${key}`);
        }
    }
});

function load(path, i18n) {
    const source = ts.transpileModule(readFileSync(new URL(`../../resources/js/${path}`, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const element =
        (tag) =>
        ({ children, ...props }) => {
            const attributes = Object.fromEntries(
                Object.entries(props).filter(([name]) => !['asChild', 'size', 'variant', 'showClose'].includes(name)),
            );
            return React.createElement(tag, attributes, children);
        };
    const context = {
        exports: {},
        require: (name) => {
            if (name === 'react') return { ...React, default: React };
        if (name === '@/locale-sync') return { formatLocale: (language) => language === 'en' ? 'en-GB' : language };
            if (name === '@/utils/translation') return load('utils/translation.ts', i18n);
            if (name === '@/i18n') return { default: i18n };
            if (name === '@/components/input-error') return load('components/input-error.tsx', i18n);
            if (name === '@/components/map/parking-detail/utils') return { getOrientationIllustration: () => '' };
            if (name === '@/components/ui/input') return { Input: element('input') };
            if (name === '@/components/ui/label') return { Label: element('label') };
            if (name === '@/components/ui/textarea') return { Textarea: element('textarea') };
            if (name === '@/lib/icon-factory') return { getBlueMarkerIcon: () => ({}), getParkingStatusIcon: () => ({}), getVioletMarkerIcon: () => ({}) };
            if (name === './zoom-control') return { default: () => null };
            if (name === 'react-leaflet') {
                const Layer = ({ name, children }) => React.createElement('fieldset', { 'aria-label': name }, children);
                const LayersControl = ({ children }) => React.createElement('div', null, children);
                LayersControl.BaseLayer = Layer;
                LayersControl.Overlay = Layer;
                return {
                    LayersControl,
                    MapContainer: ({ children }) => React.createElement('div', null, children),
                    FeatureGroup: ({ children }) => React.createElement('div', null, children),
                    TileLayer: () => null,
                    Marker: ({ alt, title }) => React.createElement('img', { alt, title }),
                };
            }
            if (name === 'react-i18next') return { useTranslation: (ns) => ({ t: i18n.getFixedT(i18n.language, ns), i18n }) };
            if (name === 'sonner') {
                return {
                    Toaster: ({ containerAriaLabel, toastOptions }) =>
                        React.createElement(
                            'section',
                            { 'aria-label': containerAriaLabel },
                            React.createElement('button', { 'aria-label': toastOptions.closeButtonAriaLabel }),
                        ),
                };
            }
            if (name === '@/hooks/use-appearance') return { useAppearance: () => ({ appearance: 'light', updateAppearance: () => {} }) };
            if (name === '@/hooks/use-search-hotkey') return { useSearchHotkey: () => {} };
            if (name === './search-store') return { openSearch: () => {} };
            if (name === '@/components/ui/tooltip') return new Proxy({}, { get: () => element('span') });
            if (name === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
            if (name === '@/components/ui/button') return { Button: element('button'), buttonVariants: () => '' };
            if (name === '@radix-ui/react-dialog') return new Proxy({}, { get: (_, key) => element(key === 'Close' ? 'button' : 'div') });
            return require(name);
        },
    };
    vm.runInNewContext(source, context);
    return context.exports;
}
const render = (component, props = {}) => renderToStaticMarkup(React.createElement(component, props));

test('toast accessibility labels follow language changes without fallback', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources, lng: 'nl', fallbackLng: false });
    const LocalizedToaster = load('components/localized-toaster.tsx', i18n).default;

    const dutch = render(LocalizedToaster);
    assert.ok(dutch.includes('aria-label="Meldingen"'));
    assert.ok(dutch.includes('aria-label="Sluiten"'));

    await i18n.changeLanguage('en');
    const english = render(LocalizedToaster);
    assert.ok(english.includes('aria-label="Notifications"'));
    assert.ok(english.includes('aria-label="Close"'));
});

test('existing local contribution errors follow a language change while server messages remain intact', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources, lng: 'nl', fallbackLng: false });
    const DetailsStep = load('components/contribute/details-step.tsx', i18n).default;
    const props = {
        data: { orientation: '', under_sign: '', restriction_days: [], description: '', parking_hours: '', parking_minutes: '', latitude: null, longitude: null },
        errors: { orientation: 'details.orientation.required', under_sign: 'details.under_sign.required', description: 'Server validation message' },
        orientationOptions: [], restrictionDays: [], setData() {},
    };

    const dutch = render(DetailsStep, props);
    assert.ok(dutch.includes('Kies hoe het vak ligt.'));
    assert.ok(dutch.includes('Geef aan of er een onderbord hangt.'));

    await i18n.changeLanguage('en');
    const english = render(DetailsStep, props);
    assert.ok(english.includes('Choose how the bay is laid out.'));
    assert.ok(english.includes('Say whether there is a sub-sign.'));
    assert.ok(english.includes('Server validation message'));
    assert.ok(!english.includes('Kies hoe het vak ligt.'));
});

for (const [language, labels] of Object.entries({
    en: ['Satellite', 'Map', 'Nearby parking spaces', 'Municipal parking spaces', 'Selected location'],
    nl: ['Satelliet', 'Kaart', 'Parkeerplaatsen in de buurt', 'Gemeentelijke parkeerplaatsen', 'Geselecteerde locatie'],
})) {
    test(`detail maps name their layers and selected marker in ${language}`, async () => {
        const i18n = i18next.createInstance();
        await i18n.init({ resources, lng: language, fallbackLng: false });
        const LocationMarkerCard = load('components/map/card-location-marker.tsx', i18n).default;

        const html = render(LocationMarkerCard, {
            latitude: 52.37, longitude: 4.9,
            nearbySpaces: [{ id: 'community', latitude: 52.37, longitude: 4.91, status: 'published' }],
            nearbyMunicipalSpaces: [{ id: 'municipal', latitude: 52.37, longitude: 4.92 }],
        });

        for (const label of labels.slice(0, 4)) assert.ok(html.includes(`aria-label="${label}"`));
        assert.ok(html.includes(`alt="${labels[4]}"`));
        assert.equal((html.match(/alt=""/g) ?? []).length, 2);
        assert.ok(!html.includes('Google Hybrid'));
    });
}

test('existing Leaflet registrations and marker options receive the new language without replacing layers', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources, lng: 'nl', fallbackLng: false });
    const { synchronizeLayerLabel, synchronizeMarkerLabel } = load('components/map/card-location-marker.tsx', i18n);
    const streetLayer = { id: 'streets' };
    const nearbyLayer = { id: 'nearby' };
    const activeLayers = new Set([streetLayer, nearbyLayer]);
    const entries = new Map();
    const control = {
        removeLayer: (layer) => entries.delete(layer),
        addBaseLayer: (layer, label) => entries.set(layer, { label, overlay: false }),
        addOverlay: (layer, label) => entries.set(layer, { label, overlay: true }),
    };
    const attributes = new Map();
    const marker = { options: {}, getElement: () => ({ setAttribute: (name, value) => attributes.set(name, value) }) };
    const update = () => {
        synchronizeLayerLabel(control, streetLayer, i18n.t('controls.streets', { ns: 'frontend/map/main' }));
        synchronizeLayerLabel(control, nearbyLayer, i18n.t('controls.nearby_spaces', { ns: 'frontend/map/main' }), true);
        synchronizeMarkerLabel(marker, i18n.t('results.selected', { ns: 'frontend/map/main' }));
    };
    update();
    assert.equal(entries.get(streetLayer).label, 'Kaart');

    await i18n.changeLanguage('en');
    update();

    assert.equal(entries.size, 2);
    assert.deepEqual(entries.get(streetLayer), { label: 'Map', overlay: false });
    assert.deepEqual(entries.get(nearbyLayer), { label: 'Nearby parking spaces', overlay: true });
    assert.deepEqual([...activeLayers], [streetLayer, nearbyLayer]);
    assert.equal(marker.options.alt, 'Selected location');
    assert.equal(marker.options.title, 'Selected location');
    assert.equal(attributes.get('aria-label'), 'Selected location');
    assert.equal(attributes.get('alt'), 'Selected location');
});

for (const [language, expected] of Object.entries({
    en: {
        close: 'Close',
        previous: 'Previous page',
        next: 'Next page',
        date: '06/10/2026',
        announcement: 'System announcement',
        theme: 'Switch theme (Light mode)',
        search: 'Search',
    },
    nl: {
        close: 'Sluiten',
        previous: 'Vorige pagina',
        next: 'Volgende pagina',
        date: '06-10-2026',
        announcement: 'Systeem aankondiging',
        theme: 'Schakel thema (Licht thema)',
        search: 'Zoeken',
    },
})) {
    test(`shared controls, notification titles and dates use ${language} without fallback`, async () => {
        const i18n = i18next.createInstance();
        await i18n.init({ resources, lng: language, fallbackLng: false });
        const { ThemeToggle } = load('components/frontend/nav/theme-toggle.tsx', i18n);
        assert.ok(render(ThemeToggle).includes(`aria-label="${expected.theme}"`));
        const SearchButton = load('components/search/search-button.tsx', i18n).default;
        assert.ok(render(SearchButton).includes(`aria-label="${expected.search}"`));
        const { DialogContent } = load('components/ui/dialog.tsx', i18n);
        const { SheetContent } = load('components/ui/sheet.tsx', i18n);
        assert.ok(render(DialogContent).includes(`>${expected.close}<`));
        assert.ok(render(SheetContent).includes(`>${expected.close}<`));
        const pagination = load('components/ui/pagination.tsx', i18n);
        assert.ok(render(pagination.PaginationPrevious).includes(`aria-label="${expected.previous}"`));
        assert.ok(render(pagination.PaginationNext).includes(`aria-label="${expected.next}"`));
        assert.equal(i18n.t('titles.system.announcement', { ns: 'backend/notifications' }), expected.announcement);
        const DateTime = load('components/localized-date-time.tsx', i18n).default;
        const date = render(DateTime, { value: '2026-10-06T12:00:00', dateOnly: true });
        assert.ok(date.includes(expected.date));
        const relative = render(DateTime, { value: '2026-10-06T12:00:00', children: 'relative label' });
        assert.ok(relative.includes(`title="${expected.date}`));
        assert.ok(relative.includes('12:00'));
        assert.ok(relative.includes('>relative label</time>'));
    });
}

test('literal message lookups in known page namespaces resolve in both languages without fallback', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources, fallbackLng: false });
    const sources = files(new URL('../../resources/js/', import.meta.url)).filter((file) => file.pathname.endsWith('.tsx'));
    let lookups = 0;
    for (const file of sources) {
        const source = readFileSync(file, 'utf8');
        let namespace = source.match(/use(?:Resource)?Translation\(['"]([^'"]+)['"]\)/)?.[1];
        const page = new URL('index.tsx', file);
        if (!namespace && existsSync(page)) {
            namespace = readFileSync(page, 'utf8').match(/useResourceTranslation\(['"]([^'"]+)['"]\)/)?.[1];
        }
        if (!namespace) continue;
        for (const match of source.matchAll(/\bt\(['"]([^'"]+)['"]/g)) {
            for (const lng of ['en', 'nl']) {
                lookups++;
                assert.ok(i18n.exists(match[1], { ns: namespace, lng, count: 2 }), `${file.pathname}: ${lng} ${namespace}:${match[1]}`);
            }
        }
    }
    assert.ok(lookups > 2000);
});


for (const language of ['en', 'nl']) {
    test(`source values resolve in ${language} and unknown values cannot leak keys`, async () => {
        const i18n = i18next.createInstance();
        await i18n.init({ resources, lng: language, fallbackLng: false });
        const { translateSourceValue } = load('utils/translation.ts', i18n);
        assert.equal(translateSourceValue('backend/imports', 'counts.new'), language === 'en' ? 'New' : 'Nieuw');
        assert.equal(translateSourceValue('backend/imports', 'counts.new_unrecognized_value'), language === 'en' ? 'Unknown' : 'Onbekend');
        assert.equal(translateSourceValue('backend/imports', 'fields.external_field', { defaultValue: 'External field' }), 'External field');
        assert.equal(translateSourceValue('backend/imports', 'counts'), language === 'en' ? 'Unknown' : 'Onbekend');
        assert.equal(translateSourceValue('backend/imports', 'result_count', { count: 2, total: 2 }), language === 'en' ? '2 records' : '2 records');
        const notifications = load('utils/notifications.tsx', i18n);
        const translate = i18n.getFixedT(language, 'backend/notifications');
        assert.equal(notifications.resolveNotificationTitleBackend(translate, 'system.announcement'), language === 'en' ? 'System announcement' : 'Systeem aankondiging');
        assert.equal(notifications.resolveNotificationTitleBackend(translate, 'unknown.future.type'), language === 'en' ? 'Notification' : 'Melding');
    });
}

for (const language of ['en', 'nl']) {
    test(`known source choices render directly from the typed ${language} catalog`, async () => {
        const i18n = i18next.createInstance();
        await i18n.init({ resources, lng: language, fallbackLng: false });
        const SourceComparison = load('pages/backend/imports/source-comparison.tsx', i18n).default;
        const html = render(SourceComparison, {
            row: { before: null, after: { name: 'Central', source_name: 'City', facility_type: 'garage' }, fields: [] },
            onShowMap() {},
        });
        assert.ok(html.includes(language === 'en' ? 'New in this delivery' : 'Nieuw in deze levering'));
        assert.ok(html.includes(language === 'en' ? 'Facility type' : 'Type voorziening'));
        assert.ok(html.includes('Garage'));
        assert.ok(!html.includes('facility_types.garage'));
    });
}
