<?php

namespace App\Http\Requests\App;

use Illuminate\Support\Facades\Gate;

class UpdateParkingRuleRequest extends StoreParkingRuleRequest
{
    public function authorize(): bool
    {
        return Gate::allows('parking-rule.update');
    }
}
