<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\VideoUploadController;
use App\Http\Controllers\VideoController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\ApiTokenController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\TenantUserController;

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::get('/plans', [PlanController::class, 'publicIndex']);

// Public Video Endpoints for Mobile Apps & Embeds
Route::get('/public/videos/{id}', [VideoController::class, 'publicShow']);
Route::get('/videos/{id}/thumbnail', [VideoController::class, 'thumbnail']);
Route::get('/videos/{id}/stream/{file}', [VideoController::class, 'stream'])->where('file', '.*');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/videos', [VideoController::class, 'index']);
    Route::put('/videos/{id}', [VideoController::class, 'update']);
    Route::delete('/videos/{id}', [VideoController::class, 'destroy']);

    Route::post('/videos/{id}/thumbnail', [VideoController::class, 'uploadThumbnail'])->middleware('feature:custom_thumbnail');

    Route::post('/videos/upload-intent', [VideoUploadController::class, 'initiate'])->middleware('feature:basic_upload');
    Route::post('/videos/{id}/chunks', [VideoUploadController::class, 'uploadChunk'])->middleware('feature:basic_upload');
    Route::post('/videos/{id}/confirm', [VideoUploadController::class, 'confirm'])->middleware('feature:basic_upload');

    Route::get('/analytics/overview', [AnalyticsController::class, 'overview'])->middleware('feature:analytics');
    Route::get('/analytics/videos/{id}', [AnalyticsController::class, 'videoAnalytics'])->middleware('feature:analytics');

    // Developer API Tokens
    Route::middleware('feature:api_access')->group(function () {
        Route::get('/tokens', [ApiTokenController::class, 'index']);
        Route::post('/tokens', [ApiTokenController::class, 'store']);
        Route::delete('/tokens/{id}', [ApiTokenController::class, 'destroy']);
    });

    // Team Management
    Route::middleware('feature:team_management')->group(function () {
        Route::get('/team', [TenantUserController::class, 'index']);
        Route::post('/team', [TenantUserController::class, 'store']);
        Route::delete('/team/{id}', [TenantUserController::class, 'destroy']);
    });

    Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);
    Route::put('/settings/password', [SettingsController::class, 'updatePassword']);
    Route::put('/settings/tenant', [SettingsController::class, 'updateTenant']);

    Route::get('/subscription', [PlanController::class, 'subscription']);

    Route::middleware('admin')->prefix('admin')->group(function () {
        // Users
        Route::get('/users', [AdminController::class, 'indexUsers']);
        Route::post('/users', [AdminController::class, 'storeUser'])->middleware('feature:team_management');
        Route::get('/users/{id}', [AdminController::class, 'showUser']);
        Route::put('/users/{id}', [AdminController::class, 'updateUser']);

        // Tenants
        Route::get('/tenants', [AdminController::class, 'indexTenants']);
        Route::get('/tenants/{id}', [AdminController::class, 'showTenant']);

        // Plans
        Route::get('/plans', [PlanController::class, 'index']);
        Route::post('/plans', [PlanController::class, 'store']);
        Route::get('/plans/{id}', [PlanController::class, 'show']);
        Route::put('/plans/{id}', [PlanController::class, 'update']);

        // Super admin routes
        Route::middleware('super_admin')->group(function () {
            Route::delete('/users/{id}', [AdminController::class, 'destroyUser']);
            Route::put('/tenants/{id}/plan', [AdminController::class, 'assignPlan']);
            Route::delete('/plans/{id}', [PlanController::class, 'destroy']);
        });
    });
});
