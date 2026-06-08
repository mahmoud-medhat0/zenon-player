<?php

use App\Http\Controllers\PageController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;

// Inertia page routes
Route::get('/', [PageController::class, 'dashboard'])->name('dashboard');
Route::get('/login', [PageController::class, 'login'])->name('login');
Route::get('/embed/{videoId}', [PageController::class, 'embed'])->name('embed');

// Auth routes (web session-based for Inertia)
Route::post('/login', function (Request $request) {
    $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    $user = \App\Models\User::where('email', $request->email)->first();

    if (!$user || !Hash::check($request->password, $user->password)) {
        throw ValidationException::withMessages([
            'email' => ['The provided credentials are incorrect.'],
        ]);
    }
    if (!$user->is_active) {
        throw ValidationException::withMessages([
            'email' => ['Your account has been deactivated.'],
        ]);
    }
    Auth::login($user, $request->boolean('remember'));
    $request->session()->regenerate();
    if (!$request->header('X-Inertia') && ($request->wantsJson() || $request->ajax())) {
        return response()->json(['message' => 'Logged in successfully']);
    }

    return redirect()->intended('/');
});

Route::post('/register', function (Request $request) {
    $request->validate([
        'name' => 'required|string|max:255',
        'email' => 'required|email|unique:users,email',
        'password' => 'required|string|min:8',
        'tenant_name' => 'required|string|max:255',
    ]);

    $tenant = \App\Models\Tenant::create([
        'name' => $request->tenant_name,
        'plan_tier' => 'free',
    ]);

    $user = \App\Models\User::create([
        'name' => $request->name,
        'email' => $request->email,
        'password' => Hash::make($request->password),
        'role' => 'owner',
        'tenant_id' => $tenant->id,
    ]);

    Auth::login($user);
    $request->session()->regenerate();

    if (!$request->header('X-Inertia') && ($request->wantsJson() || $request->ajax())) {
        return response()->json(['message' => 'Registered successfully']);
    }

    return redirect()->intended('/');
});

Route::post('/logout', function (Request $request) {
    Auth::logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    if (!$request->header('X-Inertia') && ($request->wantsJson() || $request->ajax())) {
        return response()->json(['message' => 'Logged out successfully']);
    }

    return redirect('/');
});

// Admin routes
Route::middleware(['auth', 'admin'])->prefix('admin')->group(function () {
    Route::get('/', [PageController::class, 'admin'])->name('admin.dashboard');
    Route::get('/users', [PageController::class, 'adminUsers'])->name('admin.users');
    Route::get('/tenants', [PageController::class, 'adminTenants'])->name('admin.tenants');
    Route::get('/plans', [PageController::class, 'adminPlans'])->name('admin.plans');
});

// Catch-all route for SPA (must be last)
Route::get('/{any}', [PageController::class, 'dashboard'])
    ->where('any', '^(?!api(?:/|$)|docs(?:/|$)|sanctum(?:/|$)|storage(?:/|$)).*');
