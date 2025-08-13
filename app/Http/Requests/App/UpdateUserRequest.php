<?php

namespace App\Http\Requests\App;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return Gate::allows('user.update');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,'.$this->route('user')->id],
            'password' => ['nullable', 'confirmed', 'min:8'],
            'role' => ['required', 'exists:roles,name'],
        ];
    }

    /**
     * Custom validation after the default rules.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $editedUser = $this->route('user');
            $currentUser = $this->user();

            if (
                $currentUser->id === $editedUser->id &&
                $this->has('role') &&
                $this->input('role') !== $editedUser->getRoleNames()->first()
            ) {
                $validator->errors()->add(
                    'role',
                    __('users.validation.self_role_change')
                );
            }
        });
    }
}
