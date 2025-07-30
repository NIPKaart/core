<?php

use App\Enums\ParkingConfirmationStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('parking_space_confirmations', function (Blueprint $table) {
            $table->id();
            $table->uuid('parking_space_id')->constrained('parking_spaces')->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->timestamp('confirmed_at');
            $table->enum('status', ParkingConfirmationStatus::all())->default(ParkingConfirmationStatus::CONFIRMED->value);
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->index(['parking_space_id', 'user_id', 'confirmed_at'], 'ps_conf_space_user_time_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_space_confirmations');
    }
};
