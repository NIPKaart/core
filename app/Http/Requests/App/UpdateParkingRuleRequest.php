<?php

namespace App\Http\Requests\App;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Editing a source changes only the page it points to; what it applies to stays the same.
 */
class UpdateParkingRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('parking-rule.update');
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'url' => ['required', 'url:https', 'max:255'],
        ];
    }
}
