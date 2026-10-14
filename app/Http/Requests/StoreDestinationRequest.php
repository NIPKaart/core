<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDestinationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'label' => ['required', 'string', 'max:100'],
            'key' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:500'],
            'sub' => ['nullable', 'string', 'max:500'],
            'type' => ['required', 'string', 'max:100'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'bounds' => ['nullable', 'array:south,north,west,east'],
            'bounds.south' => ['required_with:bounds', 'numeric', 'between:-90,90'],
            'bounds.north' => ['required_with:bounds', 'numeric', 'between:-90,90', 'gte:bounds.south'],
            'bounds.west' => ['required_with:bounds', 'numeric', 'between:-180,180'],
            'bounds.east' => ['required_with:bounds', 'numeric', 'between:-180,180', 'gte:bounds.west'],
        ];
    }
}
