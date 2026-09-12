<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $connection = config('activitylog.database_connection');
        $table = config('activitylog.table_name');

        Schema::connection($connection)->table($table, function (Blueprint $table) {
            // Users and tenants use UUID primary keys. The package's default
            // nullableMorphs() creates integer columns unless UUID morphs are
            // configured globally, which truncates UUIDs on MySQL.
            $table->uuid('causer_id')->nullable()->change();
            $table->uuid('subject_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        $connection = config('activitylog.database_connection');
        $table = config('activitylog.table_name');

        Schema::connection($connection)->table($table, function (Blueprint $table) {
            $table->unsignedBigInteger('causer_id')->nullable()->change();
            $table->unsignedBigInteger('subject_id')->nullable()->change();
        });
    }
};
