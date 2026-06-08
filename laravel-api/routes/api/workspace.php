<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\ApiTokenController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\TenantUserController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:web')->group(function () {
    Route::get('/analytics/overview', [AnalyticsController::class, 'overview'])->middleware('feature:analytics');
    Route::get('/analytics/videos/{id}', [AnalyticsController::class, 'videoAnalytics'])->middleware('feature:analytics');

    Route::middleware('feature:api_access')->group(function () {
        Route::get('/tokens', [ApiTokenController::class, 'index']);
        Route::post('/tokens', [ApiTokenController::class, 'store']);
        Route::delete('/tokens/{id}', [ApiTokenController::class, 'destroy']);
    });

    Route::middleware('feature:team_management')->group(function () {
        Route::get('/team', [TenantUserController::class, 'index']);
        Route::post('/team', [TenantUserController::class, 'store']);
        Route::delete('/team/{id}', [TenantUserController::class, 'destroy']);
    });

    Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);
    Route::put('/settings/password', [SettingsController::class, 'updatePassword']);
    Route::put('/settings/tenant', [SettingsController::class, 'updateTenant']);

    Route::get('/subscription', [PlanController::class, 'subscription']);
});
