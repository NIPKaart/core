<?php

namespace App\Console\Commands;

use App\Enums\RuleLinkStatus;
use App\Models\ParkingRule;
use App\Services\ParkingRuleLinkChecker;
use Illuminate\Console\Command;

class CheckParkingRuleLinks extends Command
{
    protected $signature = 'nipkaart:check-rule-links';

    protected $description = 'Check whether every official parking-rule link still opens';

    public function handle(ParkingRuleLinkChecker $checker): int
    {
        $outcomes = [];
        ParkingRule::query()->orderBy('id')->each(function (ParkingRule $rule) use ($checker, &$outcomes) {
            $outcomes[] = $checker->check($rule);
        });

        $counts = collect($outcomes)->countBy(fn (RuleLinkStatus $status) => $status->value);
        $this->info(sprintf(
            'Checked %d links: %d ok, %d redirected, %d broken.',
            count($outcomes),
            $counts[RuleLinkStatus::OK->value] ?? 0,
            $counts[RuleLinkStatus::REDIRECTED->value] ?? 0,
            $counts[RuleLinkStatus::BROKEN->value] ?? 0,
        ));

        return self::SUCCESS;
    }
}
