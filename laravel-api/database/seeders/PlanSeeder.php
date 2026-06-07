<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Free',
                'slug' => 'free',
                'price_monthly' => 0,
                'price_yearly' => 0,
                'max_users' => 1,
                'max_storage_gb' => 1,
                'max_video_length_sec' => 300,
                'features' => ['basic_upload', 'sd_streaming'],
                'is_active' => true,
            ],
            [
                'name' => 'Starter',
                'slug' => 'starter',
                'price_monthly' => 9.99,
                'price_yearly' => 99.99,
                'max_users' => 5,
                'max_storage_gb' => 50,
                'max_video_length_sec' => 1800,
                'features' => ['basic_upload', 'hd_streaming', 'analytics', 'custom_thumbnail'],
                'is_active' => true,
            ],
            [
                'name' => 'Pro',
                'slug' => 'pro',
                'price_monthly' => 29.99,
                'price_yearly' => 299.99,
                'max_users' => 25,
                'max_storage_gb' => 500,
                'max_video_length_sec' => 7200,
                'features' => ['basic_upload', 'hd_streaming', '4k_streaming', 'analytics', 'custom_thumbnail', 'privacy_controls', 'team_management'],
                'is_active' => true,
            ],
            [
                'name' => 'Enterprise',
                'slug' => 'enterprise',
                'price_monthly' => 99.99,
                'price_yearly' => 999.99,
                'max_users' => 100,
                'max_storage_gb' => 2000,
                'max_video_length_sec' => 14400,
                'features' => ['basic_upload', 'hd_streaming', '4k_streaming', 'analytics', 'custom_thumbnail', 'privacy_controls', 'team_management', 'api_access', 'priority_support', 'custom_branding'],
                'is_active' => true,
            ],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(
                ['slug' => $plan['slug']],
                $plan
            );
        }
    }
}
