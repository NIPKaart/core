<?php

use App\Models\ParkingRule;
use Database\Seeders\ParkingRuleSeeder;

it('seeds municipal parking rules with matching country ownership', function () {
    $this->seed(ParkingRuleSeeder::class);

    $this->assertDatabaseCount('parking_rules', 30);

    foreach (ParkingRule::with('municipality')->get() as $rule) {
        expect($rule->municipality)->not->toBeNull();
        expect($rule->country_id)->toBe($rule->municipality->country_id);
        expect($rule->nationwide)->toBeFalse();
    }
});
