<?php

namespace App\Http\Requests;

use App\Models\ParkingSpace;

class StoreStandaloneParkingSpaceRequest extends StoreLocationRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('viewAny', ParkingSpace::class)
            && $this->user()->can('bulkUpdate', ParkingSpace::class)
            && $this->user()->can('create', ParkingSpace::class);
    }

    public function rules(): array
    {
        return [
            ...parent::rules(),
            'submission_id' => ['required', 'uuid'],
            'street_view_confirmed' => ['required', 'accepted'],
        ];
    }
}
