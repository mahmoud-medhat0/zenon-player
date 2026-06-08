<?php

use App\Http\Controllers\VideoController;
use App\Http\Controllers\VideoUploadController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/videos', [VideoController::class, 'index']);
    Route::put('/videos/{id}', [VideoController::class, 'update']);
    Route::delete('/videos/{id}', [VideoController::class, 'destroy']);

    Route::post('/videos/{id}/thumbnail', [VideoController::class, 'uploadThumbnail'])->middleware('feature:custom_thumbnail');
    Route::post('/videos/{id}/token', [VideoController::class, 'generateToken']);

    Route::post('/videos/upload-intent', [VideoUploadController::class, 'initiate'])->middleware('feature:basic_upload');
    Route::post('/videos/{id}/chunks', [VideoUploadController::class, 'uploadChunk'])->middleware('feature:basic_upload');
    Route::post('/videos/{id}/confirm', [VideoUploadController::class, 'confirm'])->middleware('feature:basic_upload');
    Route::post('/videos/{id}/cloudflare-confirm', [VideoUploadController::class, 'cloudflareConfirm'])->middleware('feature:basic_upload');
});
