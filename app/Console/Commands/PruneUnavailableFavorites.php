<?php

namespace App\Console\Commands;

use App\Models\Favorite;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('nipkaart:prune-unavailable-favorites {--execute : Explicitly remove the unavailable references; defaults to a count only}')]
#[Description('Count obsolete favorites; removal requires an explicit --execute')]
class PruneUnavailableFavorites extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $query = Favorite::query()->whereNotIn('id', Favorite::available()->select('id'));
        if (! $this->option('execute')) {
            $this->info("Unavailable favorites: {$query->count()}. No records changed.");

            return self::SUCCESS;
        }
        $removed = $query->delete();
        $this->info("Removed {$removed} unavailable favorites.");

        return self::SUCCESS;
    }
}
