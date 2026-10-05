<?php

namespace App\Services;

use App\Enums\RuleLinkStatus;
use App\Models\ParkingRule;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Checks whether an official parking-rule link still opens, without reading or judging the page itself.
 *
 * Redirects are followed to find out where the link ends up, but the stored address never changes: an admin decides
 * whether to update it. A failing link stays visible to visitors; it is only reported to admins.
 */
final class ParkingRuleLinkChecker
{
    public const int TIMEOUT_SECONDS = 10;

    public const int MAX_REDIRECTS = 5;

    /**
     * Check the rule's link and record the outcome on the rule.
     */
    public function check(ParkingRule $rule): RuleLinkStatus
    {
        $outcome = $this->probe($rule->url);
        $broken = $outcome['status'] === RuleLinkStatus::BROKEN;

        $rule->forceFill([
            'link_status' => $outcome['status'],
            'link_http_status' => $outcome['http_status'],
            'link_error' => $outcome['error'],
            'link_final_url' => $outcome['final_url'],
            'link_checked_at' => now(),
            'link_failing_since' => $broken ? ($rule->link_failing_since ?? now()) : null,
        ]);
        $rule->timestamps = false;
        $rule->save();
        $rule->timestamps = true;

        return $outcome['status'];
    }

    /**
     * Request the address and follow redirects ourselves, so the final address is known.
     *
     * @return array{status: RuleLinkStatus, http_status: ?int, error: ?string, final_url: ?string}
     */
    private function probe(string $url): array
    {
        $current = $url;

        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            try {
                $response = Http::withoutRedirecting()
                    ->withHeaders(['User-Agent' => config('app.name').' link check ('.config('app.url').')', 'Accept' => 'text/html,*/*;q=0.8'])
                    ->connectTimeout(5)
                    ->timeout(self::TIMEOUT_SECONDS)
                    ->get($current);
            } catch (ConnectionException $exception) {
                return $this->outcome(RuleLinkStatus::BROKEN, null, $this->describe($exception), $url, $current);
            }

            if ($response->redirect()) {
                $location = $response->header('Location');
                if ($location === '') {
                    return $this->outcome(RuleLinkStatus::BROKEN, $response->status(), 'missing_location', $url, $current);
                }
                $current = (string) UriResolver::resolve(new Uri($current), new Uri($location));

                continue;
            }

            if ($response->successful()) {
                return $this->outcome($current === $url ? RuleLinkStatus::OK : RuleLinkStatus::REDIRECTED, $response->status(), null, $url, $current);
            }

            return $this->outcome(RuleLinkStatus::BROKEN, $response->status(), null, $url, $current);
        }

        return $this->outcome(RuleLinkStatus::BROKEN, null, 'too_many_redirects', $url, $current);
    }

    /**
     * @return array{status: RuleLinkStatus, http_status: ?int, error: ?string, final_url: ?string}
     */
    private function outcome(RuleLinkStatus $status, ?int $httpStatus, ?string $error, string $url, string $current): array
    {
        return ['status' => $status, 'http_status' => $httpStatus, 'error' => $error, 'final_url' => $current === $url ? null : $current];
    }

    /**
     * A short, translatable reason for a request that got no answer.
     */
    private function describe(ConnectionException $exception): string
    {
        $message = strtolower($exception->getMessage());

        return match (true) {
            str_contains($message, 'timed out'), str_contains($message, 'timeout') => 'timeout',
            str_contains($message, 'resolve host'), str_contains($message, 'name or service not known') => 'dns',
            str_contains($message, 'ssl'), str_contains($message, 'certificate') => 'tls',
            default => 'connection',
        };
    }
}
