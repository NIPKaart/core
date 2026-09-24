<?php

namespace App\Console\Commands;

use App\Models\DatasetSource;
use App\Models\Municipality;
use Illuminate\Console\Command;

class RegisterDataset extends Command
{
    protected $signature = 'nipkaart:register-dataset {dataset : Configured dataset ID} {municipality : Existing municipality ID}';

    protected $description = 'Register a configured municipal dataset for manual import review';

    public function handle(): int
    {
        $code = $this->argument('dataset');
        $definition = config('municipal-deliveries.sources', [])[$code] ?? null;
        if (! isset($definition['registration'], $definition['municipality'])) {
            $this->error('Unknown dataset: '.$code);

            return self::FAILURE;
        }

        $expected = $definition['municipality'];
        $municipality = Municipality::with(['country', 'province'])->find($this->argument('municipality'));
        if (! $municipality || $municipality->name !== $expected['name'] || $municipality->country?->code !== $expected['country'] || $municipality->province?->geocode !== $expected['province']) {
            $this->error("Select {$expected['name']} in {$expected['province']}, {$expected['country']}.");

            return self::FAILURE;
        }

        DatasetSource::firstOrCreate(['code' => $code], [
            ...$definition['registration'],
            'municipality_id' => $municipality->id,
        ]);
        $this->info('Dataset registered. Review each delivery in the import screen; source publication restrictions still apply.');

        return self::SUCCESS;
    }
}
