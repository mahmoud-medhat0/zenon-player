<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TenantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'plan_tier' => $this->plan_tier,
            'is_active' => $this->is_active,
            'plan' => new PlanResource($this->whenLoaded('plan')),
            'users_count' => $this->whenCounted('users'),
            'videos_count' => $this->whenCounted('videos'),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
