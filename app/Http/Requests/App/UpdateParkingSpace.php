<?php

namespace App\Http\Requests\App;

use App\Enums\ParkingStatus;
use App\Enums\RejectionReason;
use App\Traits\ValidatesParkingSpaceDetails;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateParkingSpace extends FormRequest
{
    use ValidatesParkingSpaceDetails;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return Gate::allows('parking-space.update');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'country_id' => ['required', 'exists:countries,id'],
            'province_id' => ['required', Rule::exists('provinces', 'id')->where('country_id', $this->input('country_id'))],
            'municipality_id' => ['required', Rule::exists('municipalities', 'id')
                ->where('country_id', $this->input('country_id'))->where('province_id', $this->input('province_id'))],

            'city' => ['nullable', 'string'],
            'suburb' => ['nullable', 'string'],
            'neighbourhood' => ['nullable', 'string'],
            'postcode' => ['required', 'string'],
            'street' => ['required', 'string'],
            'amenity' => ['nullable', 'string'],

            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],

            ...$this->parkingSpaceDetailRules(requireUnderSign: false),

            'status' => ['required', Rule::enum(ParkingStatus::class)],
            'rejection_reason' => [Rule::requiredIf($this->isBecomingRejected()), 'nullable', Rule::enum(RejectionReason::class)],
            'rejection_note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Whether this update rejects a place that was not rejected before, which needs a reason.
     */
    private function isBecomingRejected(): bool
    {
        return $this->input('status') === ParkingStatus::REJECTED->value
            && $this->route('parking_space')?->status !== ParkingStatus::REJECTED;
    }
}
