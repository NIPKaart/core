import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function render({ processing = false, errors = {} } = {}) {
    let closed = 0;
    let submission;
    const changes = [];
    const context = {
        exports: {},
        require: (name) => {
            if (name === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
            if (name === '@inertiajs/react') return { useForm: () => ({
                data: { name: 'New User', email: 'new@example.com', password: '', password_confirmation: '', role: '' },
                errors, processing,
                setData: (...args) => changes.push(args),
                submit: (...args) => { submission = args; },
            }) };
            if (name === '@/routes/app') return { __esModule: true, default: { users: { store: () => ({ url: '/admin/users', method: 'post' }) } } };
            if (name.startsWith('@/')) return new Proxy({}, { get: (_, key) => key });
            return require(name);
        },
    };
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../resources/js/pages/backend/users/create-sheet.tsx', import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, context);
    return { tree: context.exports.CreateUserSheet({ open: true, roles: [{ id: 1, name: 'user' }], onClose: () => closed++ }), changes, closed: () => closed, submission: () => submission };
}
function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}

test('the sheet submits through the existing route and cancellation does not submit', () => {
    const view = render();
    nodes(view.tree).find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(view.submission()[0].url, '/admin/users');
    assert.equal(view.submission()[0].method, 'post');
    assert.equal(view.submission()[1].preserveScroll, true);
    const cancel = nodes(view.tree).find((node) => node.type === 'Button' && node.props.children === 'sheet.cancel');
    assert.equal(cancel.props.type, 'button');
    cancel.props.onClick();
    assert.equal(view.closed(), 1);
});

test('processing prevents closing by overlay, Escape and both cancel controls', () => {
    const view = render({ processing: true });
    view.tree.props.onOpenChange(false);
    for (const button of nodes(view.tree).filter((node) => node.type === 'Button')) {
        assert.equal(button.props.disabled, true);
        button.props.onClick?.();
    }
    assert.equal(view.closed(), 0);
    assert.ok(nodes(view.tree).filter((node) => node.type === 'fieldset').every((node) => node.props.disabled));
});

test('validation errors are linked to fields and role selection updates the submitted data', () => {
    const view = render({ errors: { email: 'Already taken', password: 'Does not match', role: 'Required' } });
    const all = nodes(view.tree);
    for (const field of ['email', 'password', 'role']) {
        const input = all.find((node) => node.props.id === `create-user-${field}`);
        assert.equal(input.props['aria-invalid'], true);
        assert.equal(input.props['aria-describedby'], `create-user-${field}-error`);
        assert.ok(all.find((node) => node.props.id === input.props['aria-describedby'] && node.props.message));
    }
    all.find((node) => node.type === 'Select').props.onValueChange('user');
    assert.deepEqual(view.changes, [['role', 'user']]);
});
