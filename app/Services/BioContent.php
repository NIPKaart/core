<?php

namespace App\Services;

use App\Enums\SupportedLocale;
use Carbon\CarbonImmutable;
use Closure;
use DateTimeImmutable;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Validator as ValidatorFactory;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use InvalidArgumentException;

class BioContent
{
    public const array ROUTES = ['home', 'location-map', 'location-map.add', 'garages', 'about', 'contact'];

    /** @return array{campaign: ?array<string, mixed>, links: list<array<string, mixed>>, socials: list<array<string, mixed>>} */
    public function resolve(): array
    {
        $content = $this->validate();
        $now = CarbonImmutable::now();
        $locale = SupportedLocale::parse(app()->getLocale()) ?? SupportedLocale::EN;
        $visible = fn (array $items): array => collect($items)
            ->filter(fn (array $item): bool => $item['enabled'])
            ->sortBy([['order', 'asc'], ['id', 'asc']])->values()->all();
        $campaign = collect($visible($content['campaigns']))->first(fn (array $item): bool => (empty($item['starts_at']) || $now->greaterThanOrEqualTo(CarbonImmutable::parse($item['starts_at'])))
            && (empty($item['ends_at']) || $now->lessThan(CarbonImmutable::parse($item['ends_at'])))
        );
        $links = array_values(array_filter($visible($content['links']), fn (array $item): bool => $campaign === null || $this->destination($item) !== $this->destination($campaign)));

        return [
            'campaign' => $campaign === null ? null : $this->localize($campaign, $locale),
            'links' => array_map(fn (array $item): array => $this->localize($item, $locale), $links),
            'socials' => array_map(fn (array $item): array => $this->localize($item, $locale), $visible($content['socials'])),
        ];
    }

    /** @return array{links: list<array<string, mixed>>, campaigns: list<array<string, mixed>>, socials: list<array<string, mixed>>} */
    public function validate(): array
    {
        $content = config('bio');
        $rules = [];
        foreach (['links', 'campaigns', 'socials'] as $group) {
            $rules[$group] = ['present', 'array', 'list'];
            $rules["$group.*"] = ['required', 'array'];
            $rules["$group.*.id"] = ['required', 'string', 'regex:/^[a-z][a-z0-9-]*$/', 'distinct:strict'];
            $rules["$group.*.enabled"] = ['required', 'boolean'];
            $rules["$group.*.order"] = ['required', 'integer'];
            $rules["$group.*.route"] = ['nullable', 'string', Rule::in(self::ROUTES)];
            $rules["$group.*.url"] = ['nullable', 'url:https'];
            foreach (['title', 'note', 'action'] as $field) {
                $required = $field === 'title' || ($group === 'campaigns' && $field === 'action');
                $rules["$group.*.$field"] = [$required ? 'required' : 'sometimes', 'array'];
                foreach (SupportedLocale::cases() as $locale) {
                    $rules["$group.*.$field.{$locale->value}"] = [$required ? 'required' : "required_with:$group.*.$field", 'string', 'max:200'];
                }
            }
            $rules["$group.*.image"] = ['nullable', 'string'];
            foreach (['starts_at', 'ends_at'] as $field) {
                $rules["$group.*.$field"] = ['nullable', 'string', function (string $attribute, mixed $value, Closure $fail): void {
                    if (! $this->isTimestamp($value)) {
                        $fail('Use a valid ISO 8601 timestamp with an explicit timezone offset.');
                    }
                }];
            }
        }

        $validator = ValidatorFactory::make(is_array($content) ? $content : [], $rules);
        $validator->after(function (Validator $validator) use ($content): void {
            $ids = [];
            foreach (['links', 'campaigns', 'socials'] as $group) {
                foreach (is_array($content[$group] ?? null) ? $content[$group] : [] as $index => $item) {
                    if (! is_array($item)) {
                        continue;
                    }
                    $prefix = "$group.$index";
                    if (empty($item['route']) === empty($item['url'])) {
                        $validator->errors()->add("$prefix.route", 'Choose exactly one named route or HTTPS URL.');
                    }
                    if (is_string($item['route'] ?? null) && ! Route::has($item['route'])) {
                        $validator->errors()->add("$prefix.route", 'The named route does not exist.');
                    }
                    if (is_string($item['id'] ?? null)) {
                        if (in_array($item['id'], $ids, true)) {
                            $validator->errors()->add("$prefix.id", 'Item IDs must be unique across the bio configuration.');
                        }
                        $ids[] = $item['id'];
                    }
                    if (isset($item['image']) && (! is_string($item['image']) || ! $this->isImage($item['image']))) {
                        $validator->errors()->add("$prefix.image", 'Choose an existing raster image under /assets/images/.');
                    }
                    if ($this->isTimestamp($item['starts_at'] ?? null) && $this->isTimestamp($item['ends_at'] ?? null)
                        && new DateTimeImmutable($item['ends_at']) <= new DateTimeImmutable($item['starts_at'])) {
                        $validator->errors()->add("$prefix.ends_at", 'The end must be after the start.');
                    }
                }
            }
        });

        if ($validator->fails()) {
            $messages = [];
            foreach ($validator->errors()->messages() as $field => $errors) {
                [$group, $index] = array_pad(explode('.', $field), 2, '');
                $id = $content[$group][$index]['id'] ?? '?';
                $messages[] = "$field [".(is_string($id) ? $id : '?').']: '.implode(' ', $errors);
            }
            throw new InvalidArgumentException("Invalid bio configuration:\n".implode("\n", $messages));
        }

        return $content;
    }

    private function isTimestamp(mixed $value): bool
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/', $value)) {
            return false;
        }
        $date = date_parse($value);

        return $date['error_count'] === 0 && $date['warning_count'] === 0;
    }

    private function isImage(string $path): bool
    {
        return str_starts_with($path, '/assets/images/') && ! str_contains($path, '..')
            && preg_match('/\.(?:webp|png|jpe?g|avif)$/i', $path)
            && is_file(public_path($path)) && @getimagesize(public_path($path)) !== false;
    }

    /** @param array<string, mixed> $item */
    private function destination(array $item): string
    {
        return $item['route'] ?? $item['url'];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function localize(array $item, SupportedLocale $locale): array
    {
        return [
            'id' => $item['id'], 'title' => $item['title'][$locale->value],
            'note' => $item['note'][$locale->value] ?? null, 'action' => $item['action'][$locale->value] ?? null,
            'route' => $item['route'] ?? null, 'url' => $item['url'] ?? null, 'image' => $item['image'] ?? null,
        ];
    }
}
