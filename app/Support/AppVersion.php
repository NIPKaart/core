<?php

namespace App\Support;

final class AppVersion
{
    public static function get(): string
    {
        // 1) ENV / config
        $v = (string) (config('app.version') ?? '');
        if ($v !== '') {
            return $v;
        }

        // 2) .version file
        $file = base_path('.version');
        if (is_file($file)) {
            $text = trim((string) file_get_contents($file));
            if ($text !== '') {
                return $text;
            }
        }

        // 3) composer.json "version"
        $composer = base_path('composer.json');
        if (is_file($composer)) {
            $json = json_decode((string) file_get_contents($composer), true);
            $cver = isset($json['version']) ? (string) $json['version'] : '';
            if ($cver !== '') {
                return $cver;
            }
        }

        // 4) only non-production: short SHA from .git, without shell_exec
        if (! app()->environment('production')) {
            if ($sha = self::gitShortSha()) {
                return "dev-{$sha}";
            }
        }

        // 5) fallback
        return 'dev';
    }

    public static function getBuild(): ?string
    {
        $b = (string) (config('app.build') ?? '');
        if ($b !== '') {
            return $b;
        }

        if (! app()->environment('production')) {
            return self::gitShortSha();
        }

        return null;
    }

    private static function gitShortSha(): ?string
    {
        $gitDir = base_path('.git');
        if (! is_dir($gitDir)) {
            return null;
        }

        $headFile = $gitDir.DIRECTORY_SEPARATOR.'HEAD';
        if (! is_file($headFile)) {
            return null;
        }

        $head = trim((string) file_get_contents($headFile));
        $commit = null;

        if (preg_match('/^[0-9a-f]{' . self::SHA1_HASH_LENGTH . '}$/i', $head)) {
            $commit = $head;
        } elseif (str_starts_with($head, 'ref: ')) {
            $ref = trim(substr($head, 5)); // bv. "refs/heads/main"

            $refPath = $gitDir.DIRECTORY_SEPARATOR.$ref;
            if (is_file($refPath)) {
                $commit = trim((string) file_get_contents($refPath));
            } else {
                // packed-refs fallback
                $packed = $gitDir.DIRECTORY_SEPARATOR.'packed-refs';
                if (is_file($packed)) {
                    $lines = file($packed, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
                    foreach ($lines as $line) {
                        if ($line === '' || $line[0] === '#') {
                            continue;
                        }
                        // "commitSHA␠ref"
                        if (preg_match('/^([0-9a-f]{' . self::GIT_SHA_LENGTH . '})\s+'.preg_quote($ref, '/').'$/i', $line, $m)) {
                            $commit = $m[1];
                            break;
                        }
                    }
                }
            }
        }

        if ($commit && preg_match('/^[0-9a-f]{' . self::SHA1_HEX_LENGTH . '}$/i', $commit)) {
            return substr($commit, 0, self::SHORT_SHA_LENGTH);
        }

        return null;
    }
}
