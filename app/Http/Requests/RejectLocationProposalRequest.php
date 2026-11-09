<?php

namespace App\Http\Requests;

use App\Enums\LocationProposalDecisionReason;
use App\Models\ParkingSpace;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RejectLocationProposalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('viewAny', ParkingSpace::class)
            && $this->user()->can('bulkUpdate', ParkingSpace::class);
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::enum(LocationProposalDecisionReason::class)->only(LocationProposalDecisionReason::rejection())],
            'match_outcome' => ['nullable', 'prohibited_unless:reason,duplicate', 'in:same_bay,different_bay,unclear'],
            'note' => ['nullable', 'string', 'max:500'],
            'revision' => ['required', 'integer', 'min:0'],
            'existing_parking_municipal_id' => ['prohibited_unless:reason,duplicate', 'nullable', 'string', 'max:255'],
            'existing_parking_space_id' => [
                Rule::requiredIf(fn (): bool => $this->input('reason') === 'duplicate' && blank($this->input('existing_parking_municipal_id'))),
                'prohibited_unless:reason,duplicate', 'prohibits:existing_parking_municipal_id', 'nullable', 'uuid',
            ],
        ];
    }
}
