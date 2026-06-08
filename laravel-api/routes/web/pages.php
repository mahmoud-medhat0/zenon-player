<?php

use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->controller(PageController::class)->group(function () {
    Route::get('/', 'dashboard')->name('dashboard');
    Route::get('/library', 'library')->name('dashboard.library');
    Route::get('/analytics', 'analytics')->name('dashboard.analytics');
    Route::get('/team', 'team')->name('dashboard.team');
    Route::get('/settings', 'settings')->name('dashboard.settings');
});

Route::controller(PageController::class)->group(function () {
    Route::get('/login', 'login')->middleware('guest')->name('login');
    Route::get('/embed/{videoId}', 'embed')->name('embed');
});

Route::get('/{any}', [PageController::class, 'dashboard'])
    ->middleware('auth')
    ->where('any', '^(?!api(?:/|$)|admin(?:/|$)|docs(?:/|$)|sanctum(?:/|$)|storage(?:/|$)).*');
