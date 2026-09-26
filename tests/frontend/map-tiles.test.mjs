import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../resources/js/lib/map-tiles.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {}, Map, Math, Promise };
vm.runInNewContext(source, context);
const { tilesCovering, TileCache } = context.exports;

test('covering tiles match the slippy map scheme, include the buffer ring and start at the centre', () => {
    const amsterdam = { west: 4.89, east: 4.91, south: 52.36, north: 52.38 };
    assert.deepEqual({ ...tilesCovering(amsterdam, 10)[0] }, { zoom: 10, x: 525, y: 336 });

    const buffered = tilesCovering(amsterdam, 10, 1);
    assert.equal(buffered.length, 9);
    assert.deepEqual({ ...buffered[0] }, { zoom: 10, x: 525, y: 336 });
});

test('covering tiles never leave the world', () => {
    const world = tilesCovering({ west: -400, east: 400, south: -89, north: 89 }, 1, 2);
    assert.equal(world.length, 4);
    assert.ok(world.every(({ x, y }) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
});

test('the tile cache shares requests, evicts the least recently used tile and retries failures', async () => {
    const requested = [];
    let fail = true;
    const cache = new TileCache(async (tile) => {
        requested.push(`${tile.zoom}/${tile.x}/${tile.y}`);
        if (tile.x === 9 && fail) throw new Error('offline');
        return tile.x;
    }, 2);

    await Promise.all([cache.fetch({ zoom: 1, x: 0, y: 0 }), cache.fetch({ zoom: 1, x: 0, y: 0 })]);
    assert.equal(cache.peek({ zoom: 1, x: 0, y: 0 }), 0);
    await cache.fetch({ zoom: 1, x: 1, y: 0 });
    await cache.fetch({ zoom: 1, x: 0, y: 0 });
    await cache.fetch({ zoom: 1, x: 2, y: 0 });
    assert.equal(cache.peek({ zoom: 1, x: 1, y: 0 }), undefined);
    assert.equal(cache.peek({ zoom: 1, x: 0, y: 0 }), 0);

    await assert.rejects(cache.fetch({ zoom: 1, x: 9, y: 0 }));
    fail = false;
    assert.equal(await cache.fetch({ zoom: 1, x: 9, y: 0 }), 9);
    assert.deepEqual(requested, ['1/0/0', '1/1/0', '1/2/0', '1/9/0', '1/9/0']);
});
