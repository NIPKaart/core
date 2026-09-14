<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('municipal_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dataset_source_id')->constrained()->restrictOnDelete();
            $table->string('bucket');
            $table->string('object_key');
            $table->string('etag');
            $table->string('state')->default('pending');
            $table->foreignId('municipal_import_id')->nullable()->constrained()->restrictOnDelete();
            $table->timestampTz('received_at')->nullable();
            $table->timestampTz('validated_at')->nullable();
            $table->boolean('late_on_receipt')->default(false);
            $table->string('error_code')->nullable();
            $table->timestampsTz();
            $table->unique(['bucket', 'object_key']);
            $table->index(['state', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('municipal_deliveries');
    }
};
