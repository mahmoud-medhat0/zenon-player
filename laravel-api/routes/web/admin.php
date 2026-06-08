<?php

use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

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
