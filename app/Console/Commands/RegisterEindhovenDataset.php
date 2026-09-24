<?php

namespace App\Console\Commands;

use App\Models\DatasetSource;
use App\Models\Municipality;
use App\Support\MunicipalSnapshot;
use Illuminate\Console\Command;

class RegisterEindhovenDataset extends Command
{
    protected $signature = 'nipkaart:register-eindhoven {municipality : Existing Eindhoven municipality ID}';

    protected $description = 'Register Eindhoven for source review; publication remains blocked';

    public function handle(): int
    {
        $municipality = Municipality::with(['country', 'province'])->find($this->argument('municipality'));
        if (! $municipality || $municipality->name !== 'Eindhoven' || $municipality->country?->code !== 'NL' || $municipality->province?->geocode !== 'NL-NB') {
            $this->error('Select Eindhoven in Noord-Brabant, Netherlands.');

            return self::FAILURE;
        }
        DatasetSource::firstOrCreate(['code' => MunicipalSnapshot::EINDHOVEN_DATASET], [
            'name' => 'Eindhoven — gehandicaptenparkeerplaatsen (bronbeoordeling)',
            'selection' => 'gehandicapten-all', 'target_type' => 'municipal',
            'source_url' => 'https://data.eindhoven.nl/explore/dataset/parkeerplaatsen/',
            'attribution' => 'Gemeente Eindhoven; publiek domein volgens het dataportaal. Algemeen gebruik, ID-stabiliteit en actualiteit nog niet bevestigd.',
            'terms_url' => 'https://data.eindhoven.nl/explore/dataset/parkeerplaatsen/information/',
            'municipality_id' => $municipality->id,
            'bounds' => [5.32, 51.35, 5.62, 51.52],
        ]);
        $this->info('Dataset registered for source review. Publication is blocked until the source mapping is verified.');

        return self::SUCCESS;
    }
}
