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
            'note' => ['nullable', 'string', 'max:500'],
            'revision' => ['required', 'integer', 'min:0'],
            'existing_parking_space_id' => ['required_if:reason,duplicate', 'prohibited_unless:reason,duplicate', 'nullable', 'uuid'],
        ];
    }
}
