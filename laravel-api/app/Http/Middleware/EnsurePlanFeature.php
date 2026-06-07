<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlanFeature
{
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $tenant = $user->tenant()->with('plan')->first();

        if (!$tenant || !$tenant->plan) {
            return response()->json([
                'message' => 'No active plan. Please subscribe to access this feature.',
                'code' => 'NO_PLAN',
            ], 403);
        }

        if (!$tenant->plan->is_active) {
            return response()->json([
                'message' => 'Your plan is no longer active. Please contact support.',
                'code' => 'PLAN_INACTIVE',
            ], 403);
        }

        $features = $tenant->plan->features ?? [];

        if (!in_array($feature, $features)) {
            return response()->json([
                'message' => "This feature is not available on your current plan ({$tenant->plan->name}). Please upgrade.",
                'code' => 'FEATURE_NOT_AVAILABLE',
                'required_feature' => $feature,
                'current_plan' => $tenant->plan->slug,
            ], 403);
        }

        return $next($request);
    }
}
