<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreContactMessageRequest extends FormRequest
{
    /** What a visitor can contact NIPKaart about; each has a label under `contact.topics`. */
    public const array TOPICS = ['question', 'map_error', 'data', 'other'];

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request. `website` is a honeypot that people never see or fill.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'topic' => ['required', Rule::in(self::TOPICS)],
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255'],
            'location' => ['nullable', 'string', 'max:500'],
            'message' => ['required', 'string', 'max:5000'],
            'website' => ['nullable', 'string'],
        ];
    }

    /** Whether the hidden honeypot field was filled, which only automated submissions do. */
    public function isSpam(): bool
    {
        return $this->filled('website');
    }
}
