<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;

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
}
