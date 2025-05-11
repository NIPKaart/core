<?php

namespace App\Http\Requests;

use App\Enums\ParkingOrientation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLocationRequest extends FormRequest
{
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
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric'],
            'longitude' => ['required', 'numeric'],
            'parking_hours' => ['nullable', 'numeric', 'min:0'],
            'parking_minutes' => ['nullable', 'numeric', 'min:0'],
            'orientation' => ['required', Rule::in(ParkingOrientation::all())],
            'window_times' => ['sometimes', 'boolean'],
            'message' => ['nullable', 'string', 'max:1000'],
            'nominatim' => ['required', 'array'],
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
            'window_times' => $this->toBoolean($this->window_times),
        ]);
    }

    /**
     * Convert to boolean
     */
    private function toBoolean($boolean): bool
    {
        return filter_var($boolean, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    }

    /**
     * Get custom error messages for validation rules.
     */
    public function messages(): array
    {
        return [
            'orientation.required' => 'Select an orientation for the parking space.',
            'orientation.in' => 'The selected orientation is invalid. Please select a valid option.',
        ];
    }
}
