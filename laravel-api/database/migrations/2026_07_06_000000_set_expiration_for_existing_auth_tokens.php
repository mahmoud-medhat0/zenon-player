<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('personal_access_tokens')
            ->where('name', 'auth_token')
            ->whereNull('expires_at')
            ->orderBy('id')
            ->chunkById(100, function ($tokens): void {
                foreach ($tokens as $token) {
                    DB::table('personal_access_tokens')
                        ->where('id', $token->id)
                        ->update([
                            'expires_at' => Carbon::parse($token->created_at)->addDay(),
                        ]);
                }
            });
    }

    public function down(): void
    {
        DB::table('personal_access_tokens')
            ->where('name', 'auth_token')
            ->update(['expires_at' => null]);
    }
};
