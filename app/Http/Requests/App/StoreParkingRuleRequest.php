<?php

namespace App\Http\Requests\App;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

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
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'country_id' => [
                'required', 'integer', 'exists:countries,id',
                Rule::when($this->boolean('nationwide'), [
                    Rule::unique('parking_rules', 'country_id')->whereNull('municipality_id')->ignore($this->route('parking_rule')),
                ]),
            ],
            'municipality_id' => [
                'required_unless:nationwide,true',
                'nullable',
                'integer',
                Rule::exists('municipalities', 'id')->where('country_id', $this->input('country_id')),
                Rule::unique('parking_rules', 'municipality_id')->where('country_id', $this->input('country_id'))->ignore($this->route('parking_rule')),
            ],
            'url' => ['required', 'url', 'max:255'],
            'nationwide' => ['required', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->boolean('nationwide')) {
            $this->merge(['municipality_id' => null]);
        }
    }

    public function messages(): array
    {
        return [
            'municipality_id.required_unless' => 'Please select a municipality unless this rule is nationwide.',
        ];
    }
}
