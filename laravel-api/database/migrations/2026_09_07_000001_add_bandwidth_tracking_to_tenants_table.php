<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            // Real, cumulative bandwidth in bytes, kept up to date by
            // BunnyBandwidthSyncService from Bunny's raw CDN logs (falls back
            // to a size x views estimate until the first sync happens).
            $table->unsignedBigInteger('bandwidth_used_bytes')->default(0);
            $table->timestamp('bandwidth_synced_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['bandwidth_used_bytes', 'bandwidth_synced_at']);
        });
    }
};
