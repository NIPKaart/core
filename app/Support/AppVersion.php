<?php

namespace App\Support;

class AppVersion
{
    public static function get(): string
    {
        $v = config('app.version');
        if (! empty($v)) {
            return (string) $v;
        }

        $file = base_path('.version');
        if (is_file($file)) {
            $text = trim((string) file_get_contents($file));
            if ($text !== '') {
                return $text;
            }
        }

        $tag = @trim((string) shell_exec('git describe --tags --abbrev=0 2>/dev/null'));
        if ($tag) {
            return $tag;
        }

        $sha = @trim((string) shell_exec('git rev-parse --short HEAD 2>/dev/null'));

        return $sha ? "dev-{$sha}" : 'dev';
    }

    public static function getBuild(): ?string
    {
        return config('app.build');
    }
}
