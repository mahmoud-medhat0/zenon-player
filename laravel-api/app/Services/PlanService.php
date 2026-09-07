<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PlanService
{
    public function getActivePlans()
    {
        return Plan::where('is_active', true)->orderBy('price_monthly')->get();
    }

    public function assignPlan(Tenant $tenant, Plan $plan): Tenant
    {
        $tenant->update([
            'plan_id' => $plan->id,
            'plan_tier' => $plan->slug,
        ]);

        activity()
            ->performedOn($tenant)
            ->withProperties(['plan_id' => $plan->id, 'plan_name' => $plan->name])
            ->event('plan_assigned')
            ->log('Plan assigned to tenant');

        return $tenant->fresh(['plan']);
    }

    public function canAddUser(Tenant $tenant): bool
    {
        $maxUsers = $tenant->getMaxUsers();
        $currentUserCount = $tenant->getCurrentUserCount();

        return $currentUserCount < $maxUsers;
    }

    public function canUploadVideo(Tenant $tenant, int $sizeBytes): bool
    {
        $plan = $tenant->plan;

        if (!$plan) {
            return false;
        }

        $currentStorage = $tenant->videos()->sum('size_bytes');
        $maxStorageBytes = $plan->max_storage_gb * 1024 * 1024 * 1024;

        return ($currentStorage + $sizeBytes) <= $maxStorageBytes;
    }

    public function canCreateVideo(Tenant $tenant, int $durationSeconds): bool
    {
        $maxDuration = $tenant->getMaxVideoLengthSec();

        return $durationSeconds <= $maxDuration;
    }

    public function getStorageUsageGb(Tenant $tenant): float
    {
        $bytes = $tenant->videos()->sum('size_bytes');

        return round($bytes / (1024 * 1024 * 1024), 2);
    }

    public function getBandwidthUsageGb(Tenant $tenant): float
    {
        if (DB::table('bunny_log_syncs')->exists()) {
            return round($tenant->bandwidth_used_bytes / (1024 * 1024 * 1024), 2);
        }

        // Fallback estimate until the Bunny log sync has processed at least
        // one day (e.g. BUNNY_ACCOUNT_API_KEY isn't set yet): proxies usage
        // as size x unique views, since the shared library gives no
        // per-tenant breakdown on its own.
        $bytes = $tenant->videos()->selectRaw('SUM(size_bytes * views) as total')->value('total') ?? 0;

        return round($bytes / (1024 * 1024 * 1024), 2);
    }

    public function canStreamVideo(Tenant $tenant): bool
    {
        $plan = $tenant->plan;

        if (!$plan) {
            return false;
        }

        $usedGb = $this->getBandwidthUsageGb($tenant);

        return $usedGb < ($plan->max_bandwidth_gb ?? 10);
    }
}
