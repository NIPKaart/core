<?php

use App\Support\SnapshotContract;

$fixtureDirectory = dirname(__DIR__, 2).'/Fixtures/import/v1/';
$cases = json_decode(file_get_contents($fixtureDirectory.'cases.json'), true, 32, JSON_THROW_ON_ERROR);

test('snapshot files produce the agreed contract decision', function (string $name, string $expected) use ($fixtureDirectory) {
    $directory = $fixtureDirectory.$name.'/';
    $context = json_decode(file_get_contents($directory.'context.json'), true, 32, JSON_THROW_ON_ERROR);

    $result = (new SnapshotContract)->check(file_get_contents($directory.'manifest.json'), $directory.'records.jsonl', $context);

    expect($result)->toBe($expected);
})->with(array_combine(array_column($cases, 'name'), array_map(fn (array $case): array => [$case['name'], $case['expected']], $cases)));

test('validation stops after its monotonic deadline', function () use ($fixtureDirectory) {
    $directory = $fixtureDirectory.'unknown-capacity/';
    $ticks = [0.0, 31.0];
    $contract = new SnapshotContract(static function () use (&$ticks): float {
        return array_shift($ticks);
    });

    $result = $contract->check(file_get_contents($directory.'manifest.json'), $directory.'records.jsonl', json_decode(file_get_contents($directory.'context.json'), true));

    expect($result)->toBe('invalid');
});
