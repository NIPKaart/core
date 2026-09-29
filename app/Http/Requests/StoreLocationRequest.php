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
            'nominatim' => ['required', 'array'],
            ...$this->parkingSpaceDetailRules(),
        ];
    }

    /**
     * Prepare inputs for validation.
     */
    protected function prepareForValidation(): void
    {
        $nominatim = json_decode($this->input('nominatim'), true);

        $this->merge([
            'nominatim' => is_array($nominatim) ? $nominatim : [],
        ]);
    }

    /**
     * Get custom error messages for validation rules.
     */
    public function messages(): array
    {
        return [
            'orientation.required' => 'Select an orientation for the parking space.',
            'orientation.enum' => 'The selected orientation is invalid. Please select a valid option.',
        ];
    }
}
