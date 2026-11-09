<?php

namespace App\Http\Requests;

use App\Enums\LocationProposalDecisionReason;
use App\Models\ParkingSpace;
use App\Traits\ValidatesParkingSpaceDetails;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class PublishLocationProposalRequest extends FormRequest
{
    use ValidatesParkingSpaceDetails;

    public const int MAX_BAYS = 20;

    public function authorize(): bool
    {
        return $this->user()->can('viewAny', ParkingSpace::class)
            && $this->user()->can('bulkUpdate', ParkingSpace::class);
    }

    public function rules(): array
    {
        return [
            'bays' => ['required', 'array', 'list', 'min:1', 'max:'.self::MAX_BAYS],
            'bays.*' => ['required', 'array:latitude,longitude,source_point_id'],
            'bays.*.latitude' => ['required', 'numeric', 'between:-90,90'],
            'bays.*.longitude' => ['required', 'numeric', 'between:-180,180'],
            'bays.*.source_point_id' => ['required', 'integer', 'min:1'],
            'revision' => ['sometimes', 'integer', 'min:0'],
            'reason' => ['nullable', Rule::enum(LocationProposalDecisionReason::class)->only(LocationProposalDecisionReason::completion())],
            'note' => ['nullable', 'string', 'max:500'],
            ...$this->parkingSpaceDetailRules(),
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $coordinates = [];
                foreach ($validator->validated()['bays'] as $index => $bay) {
                    // Match the precision stored by PostgreSQL, including signed zero.
                    $key = sprintf('%.7F,%.7F', (float) $bay['latitude'] + 0.0, (float) $bay['longitude'] + 0.0);
                    if (isset($coordinates[$key])) {
                        $validator->errors()->add("bays.{$index}.latitude", __('parking_spaces.proposal.duplicate'));
                    }
                    $coordinates[$key] = true;
                }
            },
        ];
    }
}
