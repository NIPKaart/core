<?php

namespace App\Http\Requests\App;

use App\Enums\ParkingOrientation;
use App\Enums\ParkingStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateParkingSpot extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return Gate::allows('parking-spot.update');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'country_id' => ['required', 'exists:countries,id'],
            'province_id' => ['required', 'exists:provinces,id'],

            'municipality' => ['required', 'string'],
            'city' => ['nullable', 'string'],
            'suburb' => ['nullable', 'string'],
            'neighbourhood' => ['nullable', 'string'],
            'postcode' => ['required', 'string'],
            'street' => ['required', 'string'],
            'amenity' => ['nullable', 'string'],

            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],

            'parking_hours' => ['nullable', 'numeric', 'min:0'],
            'parking_minutes' => ['nullable', 'numeric', 'min:0'],
            'orientation' => ['required', Rule::in(ParkingOrientation::all())],
            'window_times' => ['required', 'boolean'],

            'description' => ['nullable', 'string'],
            'status' => ['required', Rule::in(ParkingStatus::all())],
        ];
    }
}
