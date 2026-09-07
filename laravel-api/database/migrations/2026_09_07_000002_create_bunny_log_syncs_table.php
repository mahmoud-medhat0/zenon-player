<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per calendar day whose Bunny CDN log has already been
        // downloaded and folded into tenants' bandwidth_used_bytes, so a
        // day is never double-counted across sync runs. Bunny only keeps
        // raw logs for 3 days, so a day must be processed within that
        // window or its bandwidth is lost for good.
        Schema::create('bunny_log_syncs', function (Blueprint $table) {
            $table->id();
            $table->date('log_date')->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bunny_log_syncs');
    }
};
