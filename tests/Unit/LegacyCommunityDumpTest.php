<?php

use App\Services\LegacyCommunityDump;

function legacyDumpFile(string $insert, bool $completed = true): string
{
    $path = tempnam(sys_get_temp_dir(), 'nipkaart-dump-');
    $sql = '';
    foreach (['countries', 'provinces', 'location_status', 'parking_rules', 'parking_locations'] as $table) {
        $sql .= "CREATE TABLE `{$table}` (\n  `id` varchar(255),\n  `description` text\n) ENGINE=InnoDB;\n";
    }
    $sql .= $insert;
    if ($completed) {
        $sql .= "\n-- Dump completed on 2026-10-09 10:00:00\n";
    }
    file_put_contents($path, $sql);

    return $path;
}

it('reads escaped literal values while ignoring unrelated account data and SQL', function () {
    $path = legacyDumpFile(<<<'SQL'
INSERT INTO `parking_locations` VALUES ('old-1','O\'Brien, (bay);\nSecond line \\ path'),('old-2',NULL),('old-3','double '' quote');
INSERT INTO `users` VALUES (1,'secret');
DROP TABLE users;
SQL);

    try {
        $data = (new LegacyCommunityDump)->read($path);

        expect($data['parking_locations'])->toBe([
            ['id' => 'old-1', 'description' => "O'Brien, (bay);\nSecond line \\ path"],
            ['id' => 'old-2', 'description' => null],
            ['id' => 'old-3', 'description' => "double ' quote"],
        ]);
        expect($data)->not->toHaveKey('users');
    } finally {
        unlink($path);
    }
});

it('refuses truncated or executable insert values', function (string $insert, bool $completed) {
    $path = legacyDumpFile($insert, $completed);

    try {
        expect(fn () => (new LegacyCommunityDump)->read($path))->toThrow(InvalidArgumentException::class);
    } finally {
        unlink($path);
    }
})->with([
    'no completion' => ["INSERT INTO `parking_locations` VALUES ('id','text');", false],
    'expression' => ["INSERT INTO `parking_locations` VALUES ('id',SLEEP(10));", true],
    'unclosed quote' => ["INSERT INTO `parking_locations` VALUES ('id','broken);", true],
    'column count' => ["INSERT INTO `parking_locations` VALUES ('id');", true],
    'unsupported insert columns' => ["INSERT INTO `parking_locations` (`id`, `description`) VALUES ('id','text');", true],
]);
