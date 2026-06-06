<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

use App\Http\Controllers\VideoUploadController;
use App\Http\Controllers\VideoController;

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/videos', [VideoController::class, 'index']);
    Route::put('/videos/{id}', [VideoController::class, 'update']);
    Route::delete('/videos/{id}', [VideoController::class, 'destroy']);
    Route::get('/videos/{id}/thumbnail', [VideoController::class, 'thumbnail']);
    Route::get('/videos/{id}/stream/{file}', [VideoController::class, 'stream'])->where('file', '.*');

    Route::post('/videos/upload-intent', [VideoUploadController::class, 'initiate']);
    Route::post('/videos/{id}/chunks', [VideoUploadController::class, 'uploadChunk']);
    Route::post('/videos/{id}/confirm', [VideoUploadController::class, 'confirm']);

    Route::get('/analytics', [\App\Http\Controllers\AnalyticsController::class, 'index']);
    Route::put('/settings/profile', [\App\Http\Controllers\SettingsController::class, 'updateProfile']);
    Route::put('/settings/password', [\App\Http\Controllers\SettingsController::class, 'updatePassword']);
    Route::put('/settings/tenant', [\App\Http\Controllers\SettingsController::class, 'updateTenant']);
});
