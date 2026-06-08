<?php

use App\Http\Controllers\PlanController;
use App\Http\Controllers\VideoController;
use Illuminate\Support\Facades\Route;

Route::get('/plans', [PlanController::class, 'publicIndex']);

Route::get('/public/videos/{id}', [VideoController::class, 'publicShow']);
Route::get('/videos/{id}/thumbnail', [VideoController::class, 'thumbnail']);
Route::get('/videos/{id}/stream/{file}', [VideoController::class, 'stream'])->where('file', '.*');
