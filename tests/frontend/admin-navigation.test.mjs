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
    const users = { href: { url: '/app/users' } };
    assert.equal(isNavigationItemActive(users, '/app/users/12/edit?q=name'), true);
    assert.equal(isNavigationItemActive(users, '/app/users-archive'), false);
    assert.equal(isNavigationItemActive({ href: '/' }, '/app/users'), false);
});

test('the more specific trash destination wins over its parent list', () => {
    const spaces = { href: '/app/parking-spaces' };
    const trash = { href: '/app/parking-spaces/trash' };
    const siblings = [spaces, trash];
    assert.equal(isNavigationItemActive(spaces, '/app/parking-spaces/trash?page=2', siblings), false);
    assert.equal(isNavigationItemActive(trash, '/app/parking-spaces/trash?page=2', siblings), true);
    assert.equal(isNavigationItemActive(spaces, '/app/parking-spaces/42/edit', siblings), true);
});

test('explicit navigation state supports shared sections and deliberate exclusions', () => {
    assert.equal(isNavigationItemActive({ href: '/app/municipal-imports', isActive: true }, '/app/parking-municipal'), true);
    assert.equal(isNavigationItemActive({ href: '/app/users', isActive: false }, '/app/users/1'), false);
});
