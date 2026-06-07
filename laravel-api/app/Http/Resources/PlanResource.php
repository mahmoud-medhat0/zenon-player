<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'price_monthly' => (float) $this->price_monthly,
            'price_yearly' => (float) $this->price_yearly,
            'max_users' => $this->max_users,
            'max_storage_gb' => $this->max_storage_gb,
            'max_video_length_sec' => $this->max_video_length_sec,
            'features' => $this->features ?? [],
            'is_active' => $this->is_active,
        ];
    }
}
