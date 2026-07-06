<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiTokenExpirationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $plan = Plan::create([
            'name' => 'API Plan',
            'slug' => 'api-plan',
            'features' => ['api_access'],
        ]);

        $tenant = Tenant::create([
            'name' => 'API Tenant',
            'plan_id' => $plan->id,
        ]);

        $this->user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'API User',
            'email' => 'api@example.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->user);
    }

    public function test_it_creates_a_token_without_expiration(): void
    {
        $this->postJson('/api/tokens', [
            'name' => 'Permanent integration',
            'expires_at' => null,
        ])->assertCreated()
            ->assertJsonPath('expires_at', null);

        $token = $this->user->tokens()
            ->where('name', 'Permanent integration')
            ->firstOrFail();

        $this->assertNull($token->expires_at);
    }

    public function test_it_creates_a_token_with_the_selected_expiration(): void
    {
        $expiresAt = now()->addDays(30)->startOfSecond();

        $this->postJson('/api/tokens', [
            'name' => 'Temporary integration',
            'expires_at' => $expiresAt->toISOString(),
        ])->assertCreated();

        $token = $this->user->tokens()
            ->where('name', 'Temporary integration')
            ->firstOrFail();

        $this->assertTrue($token->expires_at->equalTo($expiresAt));
    }

    public function test_it_rejects_an_expiration_in_the_past(): void
    {
        $this->postJson('/api/tokens', [
            'name' => 'Invalid integration',
            'expires_at' => now()->subMinute()->toISOString(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('expires_at');

        $this->assertDatabaseMissing('personal_access_tokens', [
            'name' => 'Invalid integration',
        ]);
    }
}
