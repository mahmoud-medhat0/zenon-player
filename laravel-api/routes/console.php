<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

use Illuminate\Support\Facades\Schedule;

Schedule::command('bunny:sync')->everyFiveMinutes()->withoutOverlapping();
// Bunny only keeps raw CDN logs for 3 days; running a few times a day gives
// plenty of headroom to catch up if a run fails.
Schedule::command('bunny:sync-bandwidth')->everySixHours()->withoutOverlapping();
