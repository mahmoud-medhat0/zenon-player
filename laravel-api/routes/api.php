<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

use App\Http\Controllers\VideoUploadController;
use App\Http\Controllers\VideoController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::get('/videos/{id}/thumbnail', [\App\Http\Controllers\VideoController::class, 'thumbnail']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/videos', [VideoController::class, 'index']);
    Route::put('/videos/{id}', [VideoController::class, 'update']);
    Route::delete('/videos/{id}', [VideoController::class, 'destroy']);
    Route::get('/videos/{id}/stream/{file}', [VideoController::class, 'stream'])->where('file', '.*');

    Route::post('/videos/upload-intent', [VideoUploadController::class, 'initiate']);
    Route::post('/videos/{id}/chunks', [VideoUploadController::class, 'uploadChunk']);
    Route::post('/videos/{id}/confirm', [VideoUploadController::class, 'confirm']);
});
