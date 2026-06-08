<?php

use App\Http\Controllers\WebAuthController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->controller(WebAuthController::class)->group(function () {
    Route::post('/login', 'login')->name('login.store');
    Route::post('/register', 'register')->name('register');
});

Route::post('/logout', [WebAuthController::class, 'logout'])->middleware('auth')->name('logout');
