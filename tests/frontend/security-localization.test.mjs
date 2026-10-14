import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import i18next from 'i18next';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/pages/settings/security.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const resources = Object.fromEntries(['nl', 'en'].map((language) => [language, {
    'backend/security': JSON.parse(readFileSync(new URL(`../../resources/locales/backend/${language}/security.json`, import.meta.url), 'utf8')),
}]));

async function mount(language, props, { requestFails = false, passkeyCancelled = false } = {}) {
    const i18n = i18next.createInstance();
    await i18n.init({ resources, lng: language, fallbackLng: false });
    const state = [];
    const effects = [];
    const buttons = new Map();
    let cursor = 0;
    let register;
    class UserCancelledError extends Error {}
    const twoFactor = Object.fromEntries(['enable', 'disable', 'confirm', 'qrCode', 'secretKey', 'recoveryCodes', 'regenerateRecoveryCodes']
        .map((action) => [action, { form: () => ({}), url: () => action }]));
    const container = ({ children }) => React.createElement('div', null, children);
    const context = {
        exports: {},
        fetch: async (url) => ({
            ok: !requestFails, status: requestFails ? 500 : 200, redirected: false,
            json: async () => url === 'qrCode' ? { svg: '<svg></svg>' } : url === 'secretKey' ? { secretKey: 'AUDIT-ONLY-KEY' } : ['AUDIT-RECOVERY-CODE'],
        }),
        require: (name) => {
            if (name === 'react') return {
                ...React,
                useEffect: (effect) => effects.push(effect),
                useState: (initial) => {
                    const index = cursor++;
                    if (!(index in state)) state[index] = initial;
                    return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
                },
            };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: i18n.getFixedT(i18n.language, 'backend/security'), i18n }) };
            if (name === '@laravel/passkeys') return {
                UserCancelledError,
                Passkeys: { isSupported: () => true, register: async () => { throw passkeyCancelled ? new UserCancelledError() : new Error('Failure'); } },
            };
            if (name === '@inertiajs/react') return { Head: () => null, router: { reload() {}, visit() {} }, Form: ({ children }) => children({ errors: {}, processing: false }) };
            if (name === '@/routes/two-factor') return { default: twoFactor };
            if (name === '@/routes/security') return { default: { edit: Object.assign(() => ({}), { url: () => '/settings/security' }) } };
            if (name === '@/routes/passkey') return { default: { destroy: { form: () => ({}) } } };
            if (name === '@/layouts/app-layout' || name === '@/layouts/settings/layout') return { default: container };
            if (name === '@/components/heading-small') return { default: ({ title, description }) => React.createElement('section', null, React.createElement('h2', null, title), description) };
            if (name === '@/components/input-error') return { default: ({ message }) => message ? React.createElement('p', { role: 'alert' }, message) : null };
            if (name === '@/components/ui/label') return { Label: ({ children, ...props }) => React.createElement('label', props, children) };
            if (name === '@/components/ui/input') return { Input: (props) => React.createElement('input', props) };
            if (name === '@/components/ui/button') return { Button: ({ children, onClick, ...props }) => {
                if (onClick) buttons.set(children, onClick);
                delete props.variant;
                return React.createElement('button', props, children);
            } };
            return require(name);
        },
    };
    vm.runInNewContext(source, context);
    function findForm(element) {
        if (!React.isValidElement(element)) return;
        if (element.type === 'form') register = element.props.onSubmit;
        React.Children.forEach(element.props.children, findForm);
    }
    function render() {
        cursor = 0;
        buttons.clear();
        const element = context.exports.default({ passkeys: [], ...props });
        findForm(element);
        const html = renderToStaticMarkup(element);
        effects.splice(0).forEach((effect) => effect());
        return html;
    }
    render();
    return { i18n, render, click: (label) => buttons.get(label)(), register: () => register({ preventDefault() {} }) };
}

for (const [language, labels] of Object.entries({
    nl: { setup: 'Instelcode tonen', pending: 'De beveiliging is nog niet actief.', scan: 'Scan deze QR-code', code: 'Verificatiecode', recovery: 'Herstelcodes tonen', hide: 'Herstelcodes verbergen', replace: 'Herstelcodes vervangen (oude codes vervallen)', remove: 'Passkey Audit device verwijderen' },
    en: { setup: 'Show setup code', pending: 'Protection is not active yet.', scan: 'Scan this QR code', code: 'Authentication code', recovery: 'Show recovery codes', hide: 'Hide recovery codes', replace: 'Replace recovery codes (invalidates old codes)', remove: 'Remove passkey Audit device' },
})) {
    test(`pending 2FA setup, recovery controls and named passkey actions render in ${language}`, async () => {
        const pending = await mount(language, { twoFactorEnabled: false, twoFactorPending: true });
        assert.ok(pending.render().includes(labels.pending));
        await pending.click(labels.setup);
        const setup = pending.render();
        assert.ok(setup.includes(labels.scan));
        assert.ok(setup.includes(labels.code));
        assert.ok(setup.includes('AUDIT-ONLY-KEY'));

        const enabled = await mount(language, { twoFactorEnabled: true, twoFactorPending: false, passkeys: [{ id: 1, name: 'Audit device', last_used_at: null }] });
        await enabled.click(labels.recovery);
        const recovery = enabled.render();
        assert.ok(recovery.includes('AUDIT-RECOVERY-CODE'));
        assert.ok(recovery.includes(labels.hide));
        assert.ok(recovery.includes(labels.replace));
        assert.ok(recovery.includes(`aria-label="${labels.remove}"`));
        await enabled.click(labels.hide);
        assert.ok(!enabled.render().includes('AUDIT-RECOVERY-CODE'));
    });
}

for (const [kind, options] of Object.entries({ request: { requestFails: true }, cancelled: { passkeyCancelled: true }, passkey: {} })) {
    test(`${kind} error follows a language switch on the security page`, async () => {
        const page = await mount('nl', { twoFactorEnabled: false, twoFactorPending: true }, options);
        if (kind === 'request') await page.click('Instelcode tonen');
        else await page.register();
        const dutch = page.render();
        assert.ok(dutch.includes(kind === 'request' ? 'Het verzoek is mislukt.' : kind === 'cancelled' ? 'Passkey-actie geannuleerd.' : 'De passkey-actie is mislukt.'));

        await page.i18n.changeLanguage('en');
        const english = page.render();
        assert.ok(english.includes(kind === 'request' ? 'Request failed.' : kind === 'cancelled' ? 'Passkey operation cancelled.' : 'Passkey operation failed.'));
        assert.ok(!english.includes(kind === 'request' ? 'Het verzoek is mislukt.' : kind === 'cancelled' ? 'Passkey-actie geannuleerd.' : 'De passkey-actie is mislukt.'));
    });
}
