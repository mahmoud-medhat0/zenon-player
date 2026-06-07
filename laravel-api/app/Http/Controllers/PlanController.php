<?php

namespace App\Http\Controllers;

use App\Http\Resources\PlanResource;
use App\Models\Plan;
use App\Models\Tenant;
use App\Services\PlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    public function __construct(
        private PlanService $planService
    ) {}

    public function publicIndex(): JsonResponse
    {
        $plans = Plan::where('is_active', true)->orderBy('price_monthly')->get();

        return response()->json([
            'plans' => PlanResource::collection($plans),
        ]);
    }

    public function index(): JsonResponse
    {
        $plans = Plan::orderBy('price_monthly')->get();

        return response()->json([
            'plans' => PlanResource::collection($plans),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|unique:plans,slug',
            'price_monthly' => 'required|numeric|min:0',
            'price_yearly' => 'required|numeric|min:0',
            'max_users' => 'required|integer|min:1',
            'max_storage_gb' => 'required|integer|min:1',
            'max_video_length_sec' => 'required|integer|min:1',
            'features' => 'required|array',
            'features.*' => 'string',
            'is_active' => 'boolean',
        ]);

        $plan = Plan::create($validated);

        activity()
            ->performedOn($plan)
            ->event('plan_created')
            ->log('Plan created by admin');

        return response()->json([
            'plan' => new PlanResource($plan),
            'message' => 'Plan created successfully.',
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $plan = Plan::findOrFail($id);

        $tenantsCount = Tenant::where('plan_id', $plan->id)->count();

        return response()->json([
            'plan' => array_merge(
                (new PlanResource($plan))->resolve(),
                ['tenants_count' => $tenantsCount]
            ),
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $plan = Plan::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|unique:plans,slug,' . $id,
            'price_monthly' => 'sometimes|numeric|min:0',
            'price_yearly' => 'sometimes|numeric|min:0',
            'max_users' => 'sometimes|integer|min:1',
            'max_storage_gb' => 'sometimes|integer|min:1',
            'max_video_length_sec' => 'sometimes|integer|min:1',
            'features' => 'sometimes|array',
            'features.*' => 'string',
            'is_active' => 'sometimes|boolean',
        ]);

        $oldData = $plan->only(['name', 'slug', 'price_monthly', 'price_yearly', 'max_users', 'max_storage_gb', 'max_video_length_sec', 'features', 'is_active']);

        $plan->update($validated);

        activity()
            ->performedOn($plan)
            ->withProperties(['old' => $oldData, 'attributes' => $plan->only(['name', 'slug', 'price_monthly', 'price_yearly', 'max_users', 'max_storage_gb', 'max_video_length_sec', 'features', 'is_active'])])
            ->event('plan_updated')
            ->log('Plan updated by admin');

        return response()->json([
            'plan' => new PlanResource($plan->fresh()),
            'message' => 'Plan updated successfully.',
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $plan = Plan::findOrFail($id);

        $tenantsCount = Tenant::where('plan_id', $plan->id)->count();

        if ($tenantsCount > 0) {
            return response()->json([
                'message' => "Cannot delete plan. {$tenantsCount} tenant(s) are currently using this plan. Reassign them first.",
            ], 422);
        }

        $plan->delete();

        activity()
            ->event('plan_deleted')
            ->log("Plan '{$plan->name}' deleted by admin");

        return response()->json([
            'message' => 'Plan deleted successfully.',
        ]);
    }

    public function subscription(Request $request): JsonResponse
    {
        $tenant = $request->user()->tenant()->with('plan')->first();

        $plan = $tenant->plan;
        $storageUsed = $this->planService->getStorageUsageGb($tenant);

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'plan_tier' => $tenant->plan_tier,
                'plan' => $plan ? new PlanResource($plan) : null,
                'storage_used_gb' => $storageUsed,
                'storage_limit_gb' => $tenant->getMaxStorageGb(),
                'users_count' => $tenant->getCurrentUserCount(),
                'users_limit' => $tenant->getMaxUsers(),
            ],
        ]);
    }
}
