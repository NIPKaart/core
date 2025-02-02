<?php

namespace App\Filament\Admin\Resources\ParkingSpotResource\Pages;

use App\Filament\Admin\Resources\ParkingSpotResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditParkingSpot extends EditRecord
{
    protected static string $resource = ParkingSpotResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\ViewAction::make(),
            Actions\DeleteAction::make(),
            Actions\ForceDeleteAction::make(),
            Actions\RestoreAction::make(),
        ];
    }
}
