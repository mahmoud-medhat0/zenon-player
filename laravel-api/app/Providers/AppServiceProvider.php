<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Load dynamic tenant domains into CORS configuration
        try {
            $allowedDomains = \Illuminate\Support\Facades\Cache::rememberForever('cors_allowed_domains', function () {
                $domains = \App\Models\Tenant::whereNotNull('allowed_domains')
                    ->pluck('allowed_domains')
                    ->flatten()
                    ->toArray();
                return array_unique(array_filter($domains));
            });

            if (!empty($allowedDomains)) {
                $currentAllowedOrigins = config('cors.allowed_origins', []);
                config(['cors.allowed_origins' => array_merge($currentAllowedOrigins, $allowedDomains)]);
            }
        } catch (\Exception $e) {
            // Fails gracefully during initial setup or if DB is offline
        }
    }
}
