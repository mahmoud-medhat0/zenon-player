<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
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

        if ($maxDuration <= 0) {
            return true; // 0 on the plan means no length limit
        }

        return $durationSeconds <= $maxDuration;
    }

    public function getStorageUsageGb(Tenant $tenant): float
    {
        $bytes = $tenant->videos()->sum('size_bytes');

        return round($bytes / (1024 * 1024 * 1024), 2);
    }

    /**
     * Bandwidth served this calendar month (UTC, matching Bunny's billing),
     * from the daily rows kept by BunnyBandwidthSyncService. Reported in
     * decimal GB like the Bunny dashboard.
     */
    public function getBandwidthUsageGb(Tenant $tenant): float
    {
        $bytes = DB::table('tenant_bandwidth_usages')
            ->where('tenant_id', $tenant->id)
            ->where('date', '>=', Carbon::now('UTC')->startOfMonth()->toDateString())
            ->sum('bytes');

        return round($bytes / 1_000_000_000, 2);
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
