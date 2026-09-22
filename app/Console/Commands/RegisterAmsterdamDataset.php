<?php

namespace App\Console\Commands;

use App\Models\DatasetSource;
use App\Models\Municipality;
use Illuminate\Console\Command;

class RegisterAmsterdamDataset extends Command
{
    protected $signature = 'nipkaart:register-amsterdam {municipality : Existing Amsterdam municipality ID}';

    protected $description = 'Register the Amsterdam E6a pilot for local review, with publication disabled';

    public function handle(): int
    {
        $municipality = Municipality::with(['country', 'province'])->find($this->argument('municipality'));
        if (! $municipality || $municipality->name !== 'Amsterdam' || $municipality->country->code !== 'NL' || $municipality->province->geocode !== 'NL-NH') {
            $this->error('Select Amsterdam in Noord-Holland, Netherlands.');

            return self::FAILURE;
        }
        DatasetSource::firstOrCreate(['code' => 'nl-amsterdam-parkeervakken-e6a'], [
            'name' => 'Amsterdam — algemene gehandicaptenparkeerplaatsen',
            'selection' => 'e6a-all', 'target_type' => 'municipal',
            'source_url' => 'https://api.data.amsterdam.nl/v1/parkeervakken/parkeervakken/',
            'attribution' => 'Gemeente Amsterdam; parkeervakken E6a; capaciteit is een schatting.',
            'terms_url' => 'https://data.overheid.nl/dataset/318a98b8-ef87-4335-9674-f5405f2bc4be',
            'municipality_id' => $municipality->id,
            'bounds' => [4.65, 52.2, 5.15, 52.5],
            'publication_enabled' => false,
        ]);
        $this->info('Dataset registered. Enable publication for the source in the import screen.');

        return self::SUCCESS;
    }
}
