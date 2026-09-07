<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Starter',
                'slug' => 'starter',
                'price_monthly' => 5.00,
                'price_yearly' => 49.00,
                'max_users' => 5,
                'max_storage_gb' => 50,
                'max_bandwidth_gb' => 250,
                'max_video_length_sec' => 1800,
                'features' => ['basic_upload', 'hd_streaming', 'analytics', 'custom_thumbnail'],
                'is_active' => true,
            ],
            [
                'name' => 'Pro',
                'slug' => 'pro',
                'price_monthly' => 19.00,
                'price_yearly' => 199.00,
                'max_users' => 15,
                'max_storage_gb' => 250,
                'max_bandwidth_gb' => 1000,
                'max_video_length_sec' => 7200,
                'features' => ['basic_upload', 'hd_streaming', '4k_streaming', 'analytics', 'custom_thumbnail', 'privacy_controls', 'team_management'],
                'is_active' => true,
            ],
            [
                'name' => 'Enterprise',
                'slug' => 'enterprise',
                'price_monthly' => 49.00,
                'price_yearly' => 529.00,
                'max_users' => 50,
                'max_storage_gb' => 1000,
                'max_bandwidth_gb' => 3000,
                'max_video_length_sec' => 14400,
                'features' => ['basic_upload', 'hd_streaming', '4k_streaming', 'analytics', 'custom_thumbnail', 'privacy_controls', 'team_management', 'api_access', 'priority_support', 'custom_branding'],
                'is_active' => true,
            ],
        ];

        $starterPlan = null;

        foreach ($plans as $planData) {
            $created = Plan::updateOrCreate(
                ['slug' => $planData['slug']],
                $planData
            );
            if ($planData['slug'] === 'starter') {
                $starterPlan = $created;
            }
        }

        // Clean up Free plan if it exists
        $freePlan = Plan::where('slug', 'free')->first();
        if ($freePlan) {
            if ($starterPlan) {
                Tenant::where('plan_id', $freePlan->id)->update(['plan_id' => $starterPlan->id]);
            }
            $freePlan->delete();
        }
    }
}
