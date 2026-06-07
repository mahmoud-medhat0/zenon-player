<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Tenant;
use App\Models\Plan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class PlanFeaturesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a dummy route that uses the middleware for testing
        Route::get('/api/test-feature', function () {
            return response()->json(['message' => 'Success']);
        })->middleware(['auth:sanctum', 'feature:analytics']);
    }

    public function test_allows_access_when_plan_has_feature()
    {
        $plan = Plan::create([
            'name' => 'Pro Plan',
            'slug' => 'pro',
            'features' => ['analytics', 'basic_upload'],
            'is_active' => true
        ]);

        $tenant = Tenant::create([
            'name' => 'Pro Tenant',
            'plan_id' => $plan->id,
            'is_active' => true
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Test User',
            'email' => 'test1@example.com',
            'password' => bcrypt('password')
        ]);

        $response = $this->actingAs($user)->getJson('/api/test-feature');

        $response->assertStatus(200);
        $response->assertJson(['message' => 'Success']);
    }

    public function test_blocks_access_when_plan_missing_feature()
    {
        $plan = Plan::create([
            'name' => 'Basic Plan',
            'slug' => 'basic',
            'features' => ['basic_upload'], // missing 'analytics'
            'is_active' => true
        ]);

        $tenant = Tenant::create([
            'name' => 'Basic Tenant',
            'plan_id' => $plan->id,
            'is_active' => true
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Test User 2',
            'email' => 'test2@example.com',
            'password' => bcrypt('password')
        ]);

        $response = $this->actingAs($user)->getJson('/api/test-feature');

        $response->assertStatus(403);
        $response->assertJsonFragment([
            'code' => 'FEATURE_NOT_AVAILABLE',
            'required_feature' => 'analytics'
        ]);
    }

    public function test_blocks_access_when_plan_is_inactive()
    {
        $plan = Plan::create([
            'name' => 'Old Plan',
            'slug' => 'old',
            'features' => ['analytics'],
            'is_active' => false // Inactive plan
        ]);

        $tenant = Tenant::create([
            'name' => 'Old Tenant',
            'plan_id' => $plan->id,
            'is_active' => true
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Test User',
            'email' => 'test_rand_' . uniqid() . '@example.com',
            'password' => bcrypt('password')
        ]);

        $response = $this->actingAs($user)->getJson('/api/test-feature');

        $response->assertStatus(403);
        $response->assertJsonFragment([
            'code' => 'PLAN_INACTIVE'
        ]);
    }

    public function test_blocks_access_when_tenant_has_no_plan()
    {
        $tenant = Tenant::create([
            'name' => 'No Plan Tenant',
            'plan_id' => null, // No plan
            'is_active' => true
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Test User',
            'email' => 'test_rand_' . uniqid() . '@example.com',
            'password' => bcrypt('password')
        ]);

        $response = $this->actingAs($user)->getJson('/api/test-feature');

        $response->assertStatus(403);
        $response->assertJsonFragment([
            'code' => 'NO_PLAN'
        ]);
    }
}
