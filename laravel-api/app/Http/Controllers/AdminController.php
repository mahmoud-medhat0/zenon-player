<?php

namespace App\Http\Controllers;

use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function __construct(
        private PlanService $planService
    ) {}

    // ─── Users ───────────────────────────────────────────

    public function indexUsers(Request $request): JsonResponse
    {
        $query = User::with('tenant')->latest();

        if ($request->has('role')) {
            $query->where('role', $request->role);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $users = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'users' => UserResource::collection($users),
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function showUser(string $id): JsonResponse
    {
        $user = User::with('tenant')->findOrFail($id);

        return response()->json([
            'user' => new UserResource($user),
        ]);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8|confirmed',
            'role' => 'required|in:owner,admin',
            'tenant_id' => 'required|exists:tenants,id',
        ]);

        $tenant = Tenant::findOrFail($request->tenant_id);

        if (!$this->planService->canAddUser($tenant)) {
            return response()->json([
                'message' => 'User limit reached for the current plan.',
            ], 422);
        }

        $temporaryPassword = $request->password;

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($temporaryPassword),
            'role' => $request->role,
            'tenant_id' => $tenant->id,
            'is_active' => true,
        ]);

        activity()
            ->performedOn($user)
            ->withProperties(['tenant_id' => $tenant->id, 'role' => $request->role])
            ->event('user_created')
            ->log('User created by admin');

        return response()->json([
            'user' => new UserResource($user->load('tenant')),
            'message' => 'User created successfully.',
        ], 201);
    }

    public function updateUser(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'role' => 'sometimes|in:owner,admin,super_admin',
            'is_active' => 'sometimes|boolean',
        ]);

        $oldData = $user->only(['name', 'email', 'role', 'is_active']);

        $user->update($request->only(['name', 'email', 'role', 'is_active']));

        activity()
            ->performedOn($user)
            ->withProperties(['old' => $oldData, 'attributes' => $user->only(['name', 'email', 'role', 'is_active'])])
            ->event('user_updated')
            ->log('User updated by admin');

        return response()->json([
            'user' => new UserResource($user->fresh()->load('tenant')),
            'message' => 'User updated successfully.',
        ]);
    }

    public function destroyUser(string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Cannot deactivate a super admin.',
            ], 422);
        }

        $user->update(['is_active' => false]);

        activity()
            ->performedOn($user)
            ->event('user_deactivated')
            ->log('User deactivated by admin');

        return response()->json([
            'message' => 'User deactivated successfully.',
        ]);
    }

    // ─── Tenants ─────────────────────────────────────────

    public function indexTenants(Request $request): JsonResponse
    {
        $query = Tenant::with('plan')->withCount('users')->latest();

        if ($request->has('search')) {
            $search = $request->search;
            $query->where('name', 'like', "%{$search}%");
        }

        if ($request->has('plan_tier')) {
            $query->where('plan_tier', $request->plan_tier);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $tenants = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'tenants' => TenantResource::collection($tenants),
            'pagination' => [
                'current_page' => $tenants->currentPage(),
                'last_page' => $tenants->lastPage(),
                'per_page' => $tenants->perPage(),
                'total' => $tenants->total(),
            ],
        ]);
    }

    public function showTenant(string $id): JsonResponse
    {
        $tenant = Tenant::with(['plan', 'users', 'videos'])->withCount(['users', 'videos'])->findOrFail($id);

        $storageUsed = $this->planService->getStorageUsageGb($tenant);

        return response()->json([
            'tenant' => array_merge(
                (new TenantResource($tenant))->resolve(),
                [
                    'storage_used_gb' => $storageUsed,
                    'storage_limit_gb' => $tenant->getMaxStorageGb(),
                ]
            ),
        ]);
    }

    public function assignPlan(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|exists:plans,id',
        ]);

        $tenant = Tenant::findOrFail($id);
        $plan = Plan::findOrFail($request->plan_id);

        $warnings = [];

        $currentUserCount = $tenant->getCurrentUserCount();
        if ($currentUserCount > $plan->max_users) {
            $warnings[] = "Tenant has {$currentUserCount} users but new plan allows only {$plan->max_users}. Excess users will need to be removed.";
        }

        $storageUsed = $this->planService->getStorageUsageGb($tenant);
        if ($storageUsed > $plan->max_storage_gb) {
            $warnings[] = "Tenant uses {$storageUsed} GB but new plan allows only {$plan->max_storage_gb} GB. Excess storage will need to be freed.";
        }

        $tenant = $this->planService->assignPlan($tenant, $plan);

        return response()->json([
            'tenant' => new TenantResource($tenant),
            'message' => 'Plan assigned successfully.',
            'warnings' => $warnings,
        ]);
    }
}
