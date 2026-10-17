<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

use Illuminate\Support\Facades\Schedule;

Schedule::command('bunny:sync')->everyFiveMinutes()->withoutOverlapping();
// Keeps this month's per-tenant bandwidth close to live. Each run rewrites
// whole days, and Bunny keeps raw CDN logs (used for the per-tenant split)
// for 3 days, so a failed run is caught up by the next one.
Schedule::command('bunny:sync-bandwidth')->hourly()->withoutOverlapping();
