<?php

use App\Http\Controllers\PageController;
use App\Http\Controllers\WebAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'dashboard'])->name('dashboard');
Route::get('/login', [PageController::class, 'login'])->middleware('guest')->name('login');
Route::get('/embed/{videoId}', [PageController::class, 'embed'])->name('embed');

Route::middleware('guest')->controller(WebAuthController::class)->group(function () {
    Route::post('/login', 'login')->name('login.store');
    Route::post('/register', 'register')->name('register');
});

Route::post('/logout', [WebAuthController::class, 'logout'])->middleware('auth')->name('logout');

Route::middleware(['auth', 'admin'])
    ->prefix('admin')
    ->name('admin.')
    ->controller(PageController::class)
    ->group(function () {
        Route::get('/', 'admin')->name('dashboard');
        Route::get('/users', 'adminUsers')->name('users');
        Route::get('/tenants', 'adminTenants')->name('tenants');
        Route::get('/plans', 'adminPlans')->name('plans');
    });

Route::get('/{any}', [PageController::class, 'dashboard'])
    ->where('any', '^(?!api(?:/|$)|docs(?:/|$)|sanctum(?:/|$)|storage(?:/|$)).*');
