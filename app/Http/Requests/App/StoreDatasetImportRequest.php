<?php

namespace App\Http\Requests\App;

use App\Models\DatasetImport;
use Illuminate\Foundation\Http\FormRequest;

class StoreDatasetImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', DatasetImport::class);
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['file' => ['required', 'file', 'max:32768']];
    }
}
