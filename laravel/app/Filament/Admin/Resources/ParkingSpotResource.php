<?php

namespace App\Filament\Admin\Resources;

use App\Enums\ParkingStatus;
use App\Filament\Admin\Resources\ParkingSpotResource\Pages;
use App\Filament\Admin\Resources\ParkingSpotResource\RelationManagers;
use App\Models\ParkingSpot;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class ParkingSpotResource extends Resource
{
    protected static ?string $model = ParkingSpot::class;

    protected static ?string $navigationLabel = 'Parking Spots';

    protected static ?string $navigationIcon = 'heroicon-o-map-pin';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Select::make('user_id')
                    ->relationship('user', 'name'),
                Forms\Components\TextInput::make('status')
                    ->required(),
                Forms\Components\TextInput::make('ip_address')
                    ->maxLength(45),
                Forms\Components\Select::make('country_id')
                    ->relationship('country', 'name')
                    ->required(),
                Forms\Components\Select::make('province_id')
                    ->relationship('province', 'name')
                    ->required(),
                Forms\Components\TextInput::make('municipality')
                    ->required()
                    ->maxLength(255),
                Forms\Components\TextInput::make('city')
                    ->required()
                    ->maxLength(255),
                Forms\Components\TextInput::make('suburb')
                    ->maxLength(255),
                Forms\Components\TextInput::make('neighbourhood')
                    ->maxLength(255),
                Forms\Components\TextInput::make('postcode')
                    ->required()
                    ->maxLength(255),
                Forms\Components\TextInput::make('street')
                    ->required()
                    ->maxLength(255),
                Forms\Components\TextInput::make('amenity')
                    ->maxLength(255),
                Forms\Components\TextInput::make('longitude')
                    ->required()
                    ->numeric(),
                Forms\Components\TextInput::make('latitude')
                    ->required()
                    ->numeric(),
                Forms\Components\TextInput::make('parking_time')
                    ->numeric(),
                Forms\Components\TextInput::make('orientation')
                    ->required(),
                Forms\Components\Toggle::make('parking_disc')
                    ->required(),
                Forms\Components\Toggle::make('window_times')
                    ->required(),
                Forms\Components\Textarea::make('description')
                    ->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('ID')
                    ->searchable(),
                Tables\Columns\TextColumn::make('country.name')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('province.name')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('municipality')
                    ->searchable(),
                Tables\Columns\TextColumn::make('city')
                    ->searchable(),
                Tables\Columns\TextColumn::make('street')
                    ->searchable(),
                Tables\Columns\TextColumn::make('status'),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('deleted_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\TrashedFilter::make(),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    Tables\Actions\ForceDeleteBulkAction::make(),
                    Tables\Actions\RestoreBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListParkingSpots::route('/'),
            'create' => Pages\CreateParkingSpot::route('/create'),
            'view' => Pages\ViewParkingSpot::route('/{record}'),
            'edit' => Pages\EditParkingSpot::route('/{record}/edit'),
        ];
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->withoutGlobalScopes([
                SoftDeletingScope::class,
            ]);
    }
}
