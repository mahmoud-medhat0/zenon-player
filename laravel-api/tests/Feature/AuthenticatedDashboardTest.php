<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Tenant;
use App\Models\Plan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AuthenticatedDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_receives_authenticated_user_after_web_login(): void
    {
        $user = $this->createActiveOwner();

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirect('/');

        $this->assertDashboardHasUser($user);
    }

    public function test_dashboard_receives_authenticated_user_after_inertia_login(): void
    {
        $user = $this->createActiveOwner();

        $this->withHeaders([
            'X-Inertia' => 'true',
            'X-Requested-With' => 'XMLHttpRequest',
        ])->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirect('/');
        $this->flushHeaders();

        $this->assertDashboardHasUser($user);
    }

    public function test_json_login_response_still_authenticates_follow_up_requests(): void
    {
        $user = $this->createActiveOwner();

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()
            ->assertJson(['message' => 'Logged in successfully']);

        $this->assertDashboardHasUser($user);
    }

    public function test_guest_admin_request_redirects_to_login(): void
    {
        $this->get('/admin')->assertRedirect('/login');
    }

    public function test_guest_dashboard_request_redirects_to_login(): void
    {
        $this->get('/')->assertRedirect('/login');
        $this->get('/settings')->assertRedirect('/login');
    }

    public function test_dashboard_section_routes_render_requested_page(): void
    {
        $user = $this->createActiveOwner();

        $this->actingAs($user)
            ->get('/settings')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings')
                ->where('activeTab', 'settings')
                ->where('auth.user.email', $user->email)
            );

        $this->actingAs($user)
            ->get('/library')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Library')
                ->where('activeTab', 'library')
            );
    }

    public function test_authenticated_user_is_redirected_away_from_login_page(): void
    {
        $user = $this->createActiveOwner();

        $this->actingAs($user)
            ->get('/login')
            ->assertRedirect('/');
    }

    public function test_inertia_register_logs_in_new_owner_with_free_plan(): void
    {
        Plan::create([
            'name' => 'Free',
            'slug' => 'free',
            'features' => ['basic_upload'],
            'is_active' => true,
        ]);

        $this->withHeaders([
            'X-Inertia' => 'true',
            'X-Requested-With' => 'XMLHttpRequest',
        ])->post('/register', [
            'name' => 'New Owner',
            'email' => 'new-owner@example.com',
            'password' => 'password',
            'tenant_name' => 'New Workspace',
        ])->assertRedirect('/');
        $this->flushHeaders();

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Library')
                ->where('auth.user.email', 'new-owner@example.com')
                ->where('auth.user.tenant.plan.slug', 'free')
            );
    }

    private function createActiveOwner(): User
    {
        $tenant = Tenant::create([
            'name' => 'Owner Workspace',
            'plan_tier' => 'free',
            'is_active' => true,
        ]);

        return User::create([
            'name' => 'Owner User',
            'tenant_id' => $tenant->id,
            'email' => 'owner@example.com',
            'password' => Hash::make('password'),
            'role' => 'owner',
            'is_active' => true,
        ]);
    }

    private function assertDashboardHasUser(User $user): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Library')
                ->where('auth.user.email', $user->email)
            );
    }
}
