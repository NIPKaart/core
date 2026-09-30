<?php

namespace App\Http\Requests;

use App\Traits\ValidatesParkingSpaceDetails;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A proposed version of a published community space: its pin and place details.
 *
 * Used by contributors proposing an improvement and by moderators correcting it before approval. The under-sign may
 * stay unknown, so improving another detail never forces a guess about it.
 */
class ParkingSpaceImprovementRequest extends FormRequest
{
    use ValidatesParkingSpaceDetails;

    /**
     * Routes and controllers authorize who may propose or review.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            ...$this->parkingSpaceDetailRules(requireUnderSign: false),
        ];
    }
}
