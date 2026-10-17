<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per tenant per UTC day. `bytes` is that tenant's share of
        // the pull zone's real daily bandwidth from Bunny's statistics API, so
        // a tenant's monthly usage is a plain SUM over the month and the sync
        // can re-run any day without double-counting. `log_bytes` holds the
        // raw CDN-log bytes the share was derived from (null when the day's
        // log was no longer available and a fallback split was used).
        Schema::create('tenant_bandwidth_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->date('date');
            $table->unsignedBigInteger('bytes')->default(0);
            $table->unsignedBigInteger('log_bytes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'date']);
            $table->index('date');
        });

        // Replaced by tenant_bandwidth_usages: the old lifetime counter never
        // reset per month and was only ever incremented, so it couldn't be
        // corrected or re-synced.
        Schema::dropIfExists('bunny_log_syncs');

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('bandwidth_used_bytes');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->unsignedBigInteger('bandwidth_used_bytes')->default(0);
        });

        Schema::create('bunny_log_syncs', function (Blueprint $table) {
            $table->id();
            $table->date('log_date')->unique();
            $table->timestamps();
        });

        Schema::dropIfExists('tenant_bandwidth_usages');
    }
};
