<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class WebAuthController extends Controller
{
    public function login(Request $request): JsonResponse|RedirectResponse
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (!$user->isActive()) {
            throw ValidationException::withMessages([
                'email' => ['Your account has been deactivated.'],
            ]);
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();
        $request->session()->save();
        $user->update(['last_login_at' => now()]);

        if ($this->expectsJsonResponse($request)) {
            return response()->json(['message' => 'Logged in successfully']);
        }

        return redirect()->intended('/');
    }

    public function register(Request $request): JsonResponse|RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'tenant_name' => 'required|string|max:255',
        ]);

        $freePlan = Plan::where('slug', 'free')->first();
        $tenant = Tenant::create([
            'name' => $data['tenant_name'],
            'plan_id' => $freePlan?->id,
            'plan_tier' => $freePlan?->slug ?? 'free',
            'is_active' => true,
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => User::ROLE_OWNER,
            'tenant_id' => $tenant->id,
            'is_active' => true,
        ]);

        Auth::login($user);
        $request->session()->regenerate();
        $request->session()->save();

        if ($this->expectsJsonResponse($request)) {
            return response()->json(['message' => 'Registered successfully']);
        }

        return redirect()->intended('/');
    }

    public function logout(Request $request): JsonResponse|RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($this->expectsJsonResponse($request)) {
            return response()->json(['message' => 'Logged out successfully']);
        }

        return redirect('/');
    }

    private function expectsJsonResponse(Request $request): bool
    {
        return !$request->header('X-Inertia') && ($request->wantsJson() || $request->ajax());
    }
}
