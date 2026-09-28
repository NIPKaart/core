<?php

namespace App\Contracts;

use App\Models\DatasetImport;
use App\Models\User;

/**
 * Intake, comparison and review decision for one dataset target type.
 */
interface DatasetImporter
{
    public function intake(string $json, User $actor): DatasetImport;

    public function intakeFromStorage(string $json, string $dataset, string $deliveryId): DatasetImport;

    /** @return array{rows: list<array<string, mixed>>, counts: array<string, int>, derivations: int, blockers: list<string>, token: string} */
    public function review(DatasetImport $import, bool $lock = false): array;

    public function decide(DatasetImport $import, User $actor, string $decision, ?string $reason, string $reviewToken, bool $geometryReviewed = false): void;
}
