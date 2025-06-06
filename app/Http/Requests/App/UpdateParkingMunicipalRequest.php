<?php

namespace App\Http\Requests\App;

use App\Enums\ParkingOrientation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateParkingMunicipalRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return Gate::allows('parking-municipal.update');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'street' => ['nullable', 'string', 'max:255'],
            'orientation' => ['nullable', Rule::in(ParkingOrientation::all())],
            'number' => ['nullable', 'integer', 'min:1'],
            'visibility' => ['required', 'boolean'],
        ];
    }
}
