<?php

namespace App\Console\Commands;

use App\Services\BioContent;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use InvalidArgumentException;

#[Signature('nipkaart:validate-bio')]
#[Description('Validate bio links, translations, images and campaign periods before publishing')]
class ValidateBio extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(BioContent $content): int
    {
        try {
            $content->validate();
        } catch (InvalidArgumentException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info('Bio configuration is valid.');

        return self::SUCCESS;
    }
}
