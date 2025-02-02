<?php

namespace App\Filament\Admin\Resources\ParkingSpotResource\Pages;

use App\Filament\Admin\Resources\ParkingSpotResource;
use Filament\Actions;
use Filament\Resources\Pages\ViewRecord;

class ViewParkingSpot extends ViewRecord
{
    protected static string $resource = ParkingSpotResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\EditAction::make(),
        ];
    }
}
