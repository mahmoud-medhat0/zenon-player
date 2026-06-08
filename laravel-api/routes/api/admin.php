<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\PlanController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:web', 'admin'])->prefix('admin')->group(function () {
    Route::get('/users', [AdminController::class, 'indexUsers']);
    Route::post('/users', [AdminController::class, 'storeUser']);
    Route::get('/users/{id}', [AdminController::class, 'showUser']);
    Route::put('/users/{id}', [AdminController::class, 'updateUser']);

    Route::get('/tenants', [AdminController::class, 'indexTenants']);
    Route::get('/tenants/{id}', [AdminController::class, 'showTenant']);

    Route::get('/plans', [PlanController::class, 'index']);
    Route::post('/plans', [PlanController::class, 'store']);
    Route::get('/plans/{id}', [PlanController::class, 'show']);
    Route::put('/plans/{id}', [PlanController::class, 'update']);

    Route::middleware('super_admin')->group(function () {
        Route::delete('/users/{id}', [AdminController::class, 'destroyUser']);
        Route::put('/tenants/{id}/plan', [AdminController::class, 'assignPlan']);
        Route::delete('/plans/{id}', [PlanController::class, 'destroy']);
    });
});
