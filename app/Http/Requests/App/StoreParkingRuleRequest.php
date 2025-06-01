<?php

namespace App\Http\Requests\App;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StoreParkingRuleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return Gate::allows('parking-rule.create');
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
            'municipality_id' => [
                'required_unless:nationwide,true',
                'nullable',
                'exists:municipalities,id',
            ],
            'url' => ['required', 'url', 'max:2048'],
            'nationwide' => ['required', 'boolean'],
        ];
    }

    public function validated($key = null, $default = null)
    {
        $data = parent::validated($key, $default);
        if (isset($data['nationwide']) && $data['nationwide']) {
            $data['municipality_id'] = '';
        }

        return $data;
    }

    public function messages(): array
    {
        return [
            'municipality_id.required_unless' => 'Please select a municipality unless this rule is nationwide.',
        ];
    }
}
