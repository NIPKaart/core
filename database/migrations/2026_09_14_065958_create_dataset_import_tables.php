<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dataset_sources', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('selection');
            $table->string('target_type');
            $table->string('publisher');
            $table->text('source_url');
            $table->string('licence')->nullable();
            $table->text('attribution');
            $table->text('terms_url');
            $table->foreignId('municipality_id')->nullable()->constrained()->restrictOnDelete();
            $table->jsonb('bounds');
            $table->unsignedSmallInteger('expected_interval_hours');
            $table->jsonb('description');
            $table->jsonb('pending_description')->nullable();
            $table->string('approval_state')->default('pending');
            $table->string('registration_error')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->text('review_reason')->nullable();
            $table->timestampTz('last_published_retrieved_at', 6)->nullable();
            $table->timestampsTz();
        });
        Schema::create('dataset_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dataset_source_id')->constrained()->restrictOnDelete();
            $table->uuid('delivery_id');
            $table->string('fingerprint', 64);
            $table->timestampTz('retrieved_at', 6);
            $table->string('state')->default('pending');
            $table->jsonb('dataset_config');
            $table->jsonb('records');
            $table->jsonb('before_values')->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_reason')->nullable();
            $table->timestampTz('reviewed_at')->nullable();
            $table->timestampsTz();
            $table->unique(['dataset_source_id', 'delivery_id']);
        });
        Schema::table('parking_municipal_spaces', function (Blueprint $table) {
            $table->integer('number')->nullable()->change();
            $table->foreignId('dataset_source_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('external_id')->nullable();
            $table->jsonb('source_record')->nullable();
            $table->jsonb('geometry_derivation')->nullable();
            $table->jsonb('last_imported_values')->nullable();
            $table->timestampTz('last_checked_at')->nullable();
            $table->unique(['dataset_source_id', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::table('parking_municipal_spaces', function (Blueprint $table) {
            $table->dropUnique(['dataset_source_id', 'external_id']);
            $table->dropConstrainedForeignId('dataset_source_id');
            $table->dropColumn(['external_id', 'source_record', 'geometry_derivation', 'last_imported_values', 'last_checked_at']);
        });
        Schema::dropIfExists('dataset_imports');
        Schema::dropIfExists('dataset_sources');
        // Nullable capacity remains: restoring NOT NULL would lose unknown values.
    }
};
