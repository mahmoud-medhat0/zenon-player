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
        $tenant = Tenant::create([
            'name' => 'Owner Workspace',
            'plan_tier' => 'free',
            'is_active' => true,
        ]);

        $user = User::create([
            'name' => 'Owner User',
            'tenant_id' => $tenant->id,
            'email' => 'owner@example.com',
            'password' => Hash::make('password'),
            'role' => 'owner',
            'is_active' => true,
        ]);

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirect('/');

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('auth.user.email', $user->email)
            );
    }
}
