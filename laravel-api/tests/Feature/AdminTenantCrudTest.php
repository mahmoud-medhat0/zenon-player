<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTenantCrudTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        $tenant = Tenant::create(['name' => 'Admin Tenant']);

        return User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Super Admin',
            'email' => 'super-admin-' . uniqid() . '@example.com',
            'password' => bcrypt('password'),
            'role' => User::ROLE_SUPER_ADMIN,
        ]);
    }

    public function test_super_admin_can_create_update_and_delete_a_tenant(): void
    {
        $admin = $this->superAdmin();
        $plan = Plan::create([
            'name' => 'Pro',
            'slug' => 'pro',
            'price_monthly' => 10,
            'price_yearly' => 100,
            'max_users' => 10,
            'max_storage_gb' => 100,
            'max_bandwidth_gb' => 100,
            'max_video_length_sec' => 3600,
            'features' => [],
            'is_active' => true,
        ]);

        $created = $this->actingAs($admin)->postJson('/api/admin/tenants', [
            'name' => 'Acme',
            'plan_id' => $plan->id,
        ]);

        $created->assertCreated()
            ->assertJsonPath('tenant.name', 'Acme')
            ->assertJsonPath('tenant.plan_tier', 'pro');

        $tenantId = $created->json('tenant.id');

        $this->actingAs($admin)
            ->putJson("/api/admin/tenants/{$tenantId}", [
                'name' => 'Acme Updated',
                'plan_id' => null,
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('tenant.name', 'Acme Updated')
            ->assertJsonPath('tenant.plan_tier', 'free')
            ->assertJsonPath('tenant.is_active', false);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/tenants/{$tenantId}")
            ->assertOk();

        $this->assertDatabaseMissing('tenants', ['id' => $tenantId]);
    }

    public function test_regular_admin_can_read_but_cannot_mutate_tenants(): void
    {
        $tenant = Tenant::create(['name' => 'Existing Tenant']);
        $admin = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Admin',
            'email' => 'admin-' . uniqid() . '@example.com',
            'password' => bcrypt('password'),
            'role' => User::ROLE_ADMIN,
        ]);

        $this->actingAs($admin)->getJson('/api/admin/tenants')->assertOk();
        $this->actingAs($admin)->postJson('/api/admin/tenants', ['name' => 'Blocked'])
            ->assertForbidden();
        $this->actingAs($admin)->deleteJson("/api/admin/tenants/{$tenant->id}")
            ->assertForbidden();
    }
}
