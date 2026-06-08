<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Tenant;
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
                ->component('Dashboard')
                ->where('auth.user.email', $user->email)
            );
    }
}
