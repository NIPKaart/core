<?php

namespace App\Filament\Admin\Resources\ParkingSpotResource\Pages;

use App\Filament\Admin\Resources\ParkingSpotResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListParkingSpots extends ListRecords
{
    protected static string $resource = ParkingSpotResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
