<?php

namespace App\Support;

final class AppVersion
{
    private const FULL_SHA_LEN = 40;

    private const SHORT_SHA_LEN = 7;

    private static ?string $cachedVersion = null;

    private static ?string $cachedBuild = null;

    public static function get(): string
    {
        if (self::$cachedVersion !== null) {
            return self::$cachedVersion;
        }

        // 1) ENV / config
        $v = (string) (config('app.version') ?? '');
        if ($v !== '') {
            return self::$cachedVersion = $v;
        }

        // 2) .version file
        $file = base_path('.version');
        if (is_file($file) && is_readable($file)) {
            $text = trim((string) file_get_contents($file));
            if ($text !== '') {
                return self::$cachedVersion = $text;
            }
        }

        // 3) composer.json "version"
        $composer = base_path('composer.json');
        if (is_file($composer) && is_readable($composer)) {
            $json = json_decode((string) file_get_contents($composer), true);
            $cver = isset($json['version']) ? (string) $json['version'] : '';
            if ($cver !== '') {
                return self::$cachedVersion = $cver;
            }
        }

        // 4) only in non-production environments
        if (! app()->environment('production')) {
            if ($sha = self::gitShortSha()) {
                return self::$cachedVersion = "dev-{$sha}";
            }
        }

        // 5) fallback
        return self::$cachedVersion = 'dev';
    }

    public static function getBuild(): ?string
    {
        if (self::$cachedBuild !== null) {
            return self::$cachedBuild;
        }

        $b = (string) (config('app.build') ?? '');
        if ($b !== '') {
            return self::$cachedBuild = $b;
        }

        if (! app()->environment('production')) {
            return self::$cachedBuild = self::gitShortSha();
        }

        return self::$cachedBuild = null;
    }

    private static function gitShortSha(): ?string
    {
        $gitDir = base_path('.git');
        if (! is_dir($gitDir) || ! is_readable($gitDir)) {
            return null;
        }

        $headFile = $gitDir.DIRECTORY_SEPARATOR.'HEAD';
        if (! is_file($headFile) || ! is_readable($headFile)) {
            return null;
        }

        $head = trim((string) file_get_contents($headFile));
        $commit = null;

        if (preg_match('/^[0-9a-f]{'.self::FULL_SHA_LEN.'}$/i', $head)) {
            $commit = $head;
        }

        elseif (str_starts_with($head, 'ref: ')) {
            $ref = trim(substr($head, 5)); // bv. "refs/heads/main"

            $refPath = $gitDir.DIRECTORY_SEPARATOR.$ref;
            if (is_file($refPath) && is_readable($refPath)) {
                $commit = trim((string) file_get_contents($refPath));
            } else {
                // packed-refs fallback
                $packed = $gitDir.DIRECTORY_SEPARATOR.'packed-refs';
                if (is_file($packed) && is_readable($packed)) {
                    $lines = file($packed, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
                    $pattern = '/^([0-9a-f]{'.self::FULL_SHA_LEN.'})\s+'.preg_quote($ref, '/').'$/i';
                    foreach ($lines as $line) {
                        if ($line === '' || $line[0] === '#') {
                            continue;
                        }
                        if (preg_match($pattern, $line, $m)) {
                            $commit = $m[1];
                            break;
                        }
                    }
                }
            }
        }

        if ($commit && preg_match('/^[0-9a-f]{'.self::FULL_SHA_LEN.'}$/i', $commit)) {
            return substr($commit, 0, self::SHORT_SHA_LEN);
        }

        return null;
    }
}
