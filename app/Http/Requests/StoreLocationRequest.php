<?php

namespace App\Http\Requests;

use App\Traits\ValidatesParkingSpaceDetails;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreLocationRequest extends FormRequest
{
    use ValidatesParkingSpaceDetails;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            ...$this->parkingSpaceDetailRules(),
        ];
    }

    /**
     * Get custom error messages for validation rules.
     */
    public function messages(): array
    {
        return [
            'orientation.required' => __('parking_spaces.validation.orientation_required'),
            'orientation.enum' => __('parking_spaces.validation.orientation_invalid'),
        ];
    }
}
