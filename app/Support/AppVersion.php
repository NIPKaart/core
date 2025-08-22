<?php

namespace App\Support;

final class AppVersion
{
    public static function get(): string
    {
        // 1) ENV / config
        if ($v = (string) (config('app.version') ?? '')) {
            return $v;
        }

        // 2) .version file
        $verFile = base_path('.version');
        if (is_file($verFile)) {
            $t = trim((string) file_get_contents($verFile));
            if ($t !== '') {
                return $t;
            }
        }

        // 3) only in non-production environments, use git short SHA
        if (! app()->environment('production')) {
            if ($sha = self::gitShortSha()) {
                return 'dev-'.$sha;
            }
        }

        // 4) fallback
        return 'dev';
    }

    public static function getBuild(): ?string
    {
        if ($b = (string) (config('app.build') ?? '')) {
            return $b;
        }

        return app()->environment('production')
            ? null
            : self::gitShortSha();
    }

    private static function gitShortSha(): ?string
    {
        $git = base_path('.git');
        if (! is_dir($git)) {
            return null;
        }

        $head = @trim((string) file_get_contents($git.'/HEAD'));
        if ($head === '') {
            return null;
        }

        $commit = null;

        if (preg_match('/^[0-9a-f]{40}$/i', $head)) {
            $commit = $head;
        } elseif (str_starts_with($head, 'ref: ')) {
            $ref = trim(substr($head, 5));

            $refPath = $git.'/'.$ref;
            if (is_file($refPath)) {
                $commit = trim((string) file_get_contents($refPath));
            } else {
                // packed-refs fallback
                $packed = $git.'/packed-refs';
                if (is_file($packed)) {
                    foreach (file($packed, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                        if ($line === '' || $line[0] === '#') {
                            continue;
                        }
                        if (preg_match('/^([0-9a-f]{40})\s+'.preg_quote($ref, '/').'$/i', $line, $m)) {
                            $commit = $m[1];
                            break;
                        }
                    }
                }
            }
        }

        return ($commit && preg_match('/^[0-9a-f]{40}$/i', $commit))
            ? substr($commit, 0, 7)
            : null;
    }
}
