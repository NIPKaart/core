<?php

namespace App\Services;

use App\Contracts\DatasetImporter;
use App\Models\DatasetSource;
use Illuminate\Validation\ValidationException;

/**
 * Selects the importer for a dataset target type or delivery format.
 */
class DatasetImports
{
    /** @var array<string, class-string<DatasetImporter>> */
    private const array TARGETS = ['municipal' => MunicipalImportService::class, 'offstreet' => OffstreetImportService::class];

    /** @var array<string, string> */
    private const array FORMATS = ['nipkaart-municipal-pilot-1' => 'municipal', 'nipkaart-offstreet-catalog-1' => 'offstreet'];

    public function forSource(DatasetSource $source): DatasetImporter
    {
        return $this->forTarget($source->target_type);
    }

    public function forTarget(string $targetType): DatasetImporter
    {
        $class = self::TARGETS[$targetType] ?? throw ValidationException::withMessages(['dataset' => 'Onbekend datasettype.']);

        return app($class);
    }

    /** A manual upload names its format; unreadable files go to the municipal importer, which reports the JSON error. */
    public function forUpload(string $json): DatasetImporter
    {
        $format = rescue(fn () => json_decode($json, true, 32, JSON_THROW_ON_ERROR)['format'] ?? null, null, false);

        return $this->forTarget(is_string($format) ? (self::FORMATS[$format] ?? 'municipal') : 'municipal');
    }
}
