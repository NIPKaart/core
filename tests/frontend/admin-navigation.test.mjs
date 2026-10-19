import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/components/nav/nav-section.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const context = { exports: {}, URL, require: () => ({}) };
vm.runInNewContext(source, context);
const { isNavigationItemActive } = context.exports;

test('navigation retains context on detail pages without matching similarly named routes', () => {
    const users = { href: { url: '/admin/users' } };
    assert.equal(isNavigationItemActive(users, '/admin/users/12/edit?q=name'), true);
    assert.equal(isNavigationItemActive(users, '/admin/users-archive'), false);
    assert.equal(isNavigationItemActive({ href: '/' }, '/admin/users'), false);
});

test('the more specific trash destination wins over its parent list', () => {
    const spaces = { href: '/admin/parking-spaces' };
    const trash = { href: '/admin/parking-spaces/trash' };
    const siblings = [spaces, trash];
    assert.equal(isNavigationItemActive(spaces, '/admin/parking-spaces/trash?page=2', siblings), false);
    assert.equal(isNavigationItemActive(trash, '/admin/parking-spaces/trash?page=2', siblings), true);
    assert.equal(isNavigationItemActive(spaces, '/admin/parking-spaces/42/edit', siblings), true);
});

test('explicit navigation state supports shared sections and deliberate exclusions', () => {
    assert.equal(isNavigationItemActive({ href: '/admin/imports', isActive: true }, '/admin/parking-municipal'), true);
    assert.equal(isNavigationItemActive({ href: '/admin/users', isActive: false }, '/admin/users/1'), false);
});

test('Mijn NIPKaart sidebar highlights only the selected personal section including paginated URLs', () => {
    const sidebarSource = ts.transpileModule(readFileSync(new URL('../../resources/js/components/app-sidebar.tsx', import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    for (const [url, selected] of [['/dashboard', null], ['/profile/destinations', 'destinations'], ['/profile/favorites', 'favorites'], ['/profile/parking-spaces?contributions_page=2', 'parking-spaces'], ['/admin/users', null]]) {
        const groups = [];
        const route = Object.assign((options) => ({ url: '/dashboard' + (options ? '?' + new URLSearchParams(options.query) : '') }), { url: () => '/dashboard' });
        const routeTree = new Proxy(route, { get: (_, key) => key === 'url' ? route.url : routeTree });
        const sidebarContext = { exports: {}, URL, require: (name) => {
            if (name === 'react/jsx-runtime') return { jsx: (type, props) => {
                if (props.group) groups.push(props.group);
                return { type, props };
            }, jsxs: (type, props) => ({ type, props }) };
            if (name === '@inertiajs/react') return { usePage: () => ({ url, props: { counts: { moderation: { open: 0 }, dataSources: { attention: 0 } } } }) };
            if (name === '@/hooks/use-authorization') return { useAuthorization: () => ({ can: () => false, hasRole: () => false }) };
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === 'lucide-react') return { icons: {} };
            if (name === '@/routes') return { dashboard: route, home: route, locationMap: route };
            if (name.startsWith('@/routes/profile/')) return { index: () => ({ url: '/profile/' + name.split('/').at(-1) }) };
            return { default: routeTree, index: route };
        } };
        vm.runInNewContext(sidebarSource, sidebarContext);
        sidebarContext.exports.AppSidebar();
        const personal = groups.find((group) => group.title === 'personal');
        assert.ok(personal);
        assert.deepEqual(Array.from(personal.items, (item) => item.href.url), ['/profile/destinations', '/profile/favorites', '/profile/parking-spaces']);
        assert.deepEqual(Array.from(personal.items.filter((item) => isNavigationItemActive(item, url, personal.items)), (item) => new URL(item.href.url, 'https://test.local').pathname.split('/').at(-1)), selected ? [selected] : []);
    }
});
