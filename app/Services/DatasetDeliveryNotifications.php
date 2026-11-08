<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class DatasetDeliveryNotifications
{
    public function configured(): bool
    {
        return filled(config('dataset-deliveries.notifications.account_id'))
            && filled(config('dataset-deliveries.notifications.queue_id'))
            && filled(config('dataset-deliveries.notifications.token'));
    }

    /** @return list<array{lease_id: string, body: mixed}> */
    public function pull(): array
    {
        $messages = $this->request('pull', ['batch_size' => 25, 'visibility_timeout_ms' => 300_000])['messages'] ?? null;
        if (! is_array($messages) || ! array_is_list($messages)) {
            throw new RuntimeException('Cloudflare did not return a delivery notification batch.');
        }

        foreach ($messages as $message) {
            if (! is_string($message['lease_id'] ?? null) || $message['lease_id'] === '') {
                throw new RuntimeException('Cloudflare returned a delivery notification without a lease.');
            }
        }

        return $messages;
    }

    /** @param list<array{lease_id: string, body: mixed}> $messages */
    public function acknowledge(array $messages): void
    {
        if ($messages !== []) {
            $result = $this->request('ack', ['acks' => array_map(
                fn (array $message): array => ['lease_id' => $message['lease_id']],
                $messages,
            )]);
            if (($result['ackCount'] ?? null) !== count($messages)) {
                throw new RuntimeException('Cloudflare did not acknowledge all delivery notifications.');
            }
        }
    }

    private function request(string $action, array $payload): array
    {
        $account = rawurlencode(config('dataset-deliveries.notifications.account_id'));
        $queue = rawurlencode(config('dataset-deliveries.notifications.queue_id'));
        $response = Http::withToken(config('dataset-deliveries.notifications.token'))
            ->acceptJson()
            ->connectTimeout(3)
            ->timeout(10)
            ->post("https://api.cloudflare.com/client/v4/accounts/{$account}/queues/{$queue}/messages/{$action}", $payload);

        if (! $response->successful() || $response->json('success') !== true) {
            throw new RuntimeException("Cloudflare delivery notification {$action} failed (HTTP {$response->status()}).");
        }

        return (array) $response->json('result');
    }
}
