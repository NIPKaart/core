import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the hook's effect and teardown without a browser or a running WebSocket server.
const source = ts.transpileModule(readFileSync(new URL('../../resources/js/hooks/use-notifications.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;

function mount(userId, configured = true) {
    const calls = [];
    let cleanup;
    let receive;
    const channel = {
        notification(handler) {
            receive = handler;
        },
        stopListening(event) {
            calls.push(['stop', event]);
        },
    };
    const echo = {
        private(name) {
            calls.push(['subscribe', name]);
            return channel;
        },
        leave(name) {
            calls.push(['leave', name]);
        },
    };
    const modules = {
        '@/echo': {
            getEcho: () => {
                calls.push(['connect']);
                return configured ? echo : undefined;
            },
        },
        '@inertiajs/react': {
            usePage: () => ({ props: { auth: { user: userId ? { id: userId } : null } } }),
            router: { reload: (options) => calls.push(['reload', options]) },
        },
        react: {
            useEffect: (effect) => {
                cleanup = effect();
            },
        },
    };
    const context = { exports: {}, require: (name) => modules[name] };
    vm.runInNewContext(source, context);
    context.exports.useNotifications();
    return { calls, cleanup, notify: () => receive({ id: 'notification' }) };
}

test('guests never connect', () => {
    assert.deepEqual(mount(null).calls, []);
});

test('missing Reverb configuration does not subscribe', () => {
    assert.deepEqual(mount(7, false).calls, [['connect']]);
});

test('authenticated notifications refresh the shared props and release the same channel', () => {
    const instance = mount(7);
    instance.notify();
    instance.cleanup();
    assert.deepEqual(JSON.parse(JSON.stringify(instance.calls)), [
        ['connect'],
        ['subscribe', 'App.Models.User.7'],
        ['reload', { only: ['notifications'] }],
        ['stop', '.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated'],
        ['leave', 'App.Models.User.7'],
    ]);
});
