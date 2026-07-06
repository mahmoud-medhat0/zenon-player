<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Tenant;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8',
            'tenant_name' => 'required|string'
        ]);

        $tenant = Tenant::create(['name' => $request->tenant_name]);
        
        $freePlan = \App\Models\Plan::where('slug', 'free')->first();
        if ($freePlan) {
            $tenant->update([
                'plan_id' => $freePlan->id,
                'plan_tier' => $freePlan->slug,
            ]);
        }
        
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'tenant_id' => $tenant->id,
            'role' => 'owner',
            'is_active' => true,
        ]);

        return response()->json([
            'user' => new UserResource($user->load('tenant.plan')),
            'token' => $user->createToken('auth_token', ['*'], now()->addDay())->plainTextToken
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if (!$user->isActive()) {
            return response()->json(['message' => 'Your account has been deactivated. Please contact support.'], 403);
        }

        $user->update(['last_login_at' => now()]);

        return response()->json([
            'user' => new UserResource($user->load('tenant.plan')),
            'token' => $user->createToken('auth_token', ['*'], now()->addDay())->plainTextToken
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => new UserResource($request->user()->load('tenant.plan')),
        ]);
    }
}
