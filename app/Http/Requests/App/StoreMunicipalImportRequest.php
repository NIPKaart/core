<?php

namespace App\Http\Requests\App;

use App\Models\MunicipalImport;
use Illuminate\Foundation\Http\FormRequest;

class StoreMunicipalImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', MunicipalImport::class);
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['file' => ['required', 'file', 'max:32768']];
    }
}
