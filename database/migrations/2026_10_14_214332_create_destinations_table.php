<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('destinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label', 100);
            $table->string('key');
            $table->string('name', 500);
            $table->string('sub', 500)->nullable();
            $table->string('type', 100);
            $table->double('latitude');
            $table->double('longitude');
            $table->json('bounds')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'label', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('destinations');
    }
};
