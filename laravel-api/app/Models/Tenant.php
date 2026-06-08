<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;

class Tenant extends Model
{
    use HasUuids, LogsActivity;

    protected $fillable = [
        'name',
        'plan_tier',
        'plan_id',
        'is_active',
        'primary_color',
        'logo_url',
        'allowed_domains',
        'webhook_url',
        'webhook_secret',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'allowed_domains' => 'array',
        ];
    }

    protected static function boot()
    {
        parent::boot();

        static::saved(function ($tenant) {
            if ($tenant->isDirty('allowed_domains')) {
                \Illuminate\Support\Facades\Cache::forget('cors_allowed_domains');
            }
        });
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function videos()
    {
        return $this->hasMany(Video::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function hasFeature(string $feature): bool
    {
        $plan = $this->plan;

        if (!$plan || !$plan->is_active) {
            return false;
        }

        $features = $plan->features ?? [];

        return in_array($feature, $features);
    }

    public function getMaxUsers(): int
    {
        return $this->plan?->max_users ?? 1;
    }

    public function getMaxStorageGb(): int
    {
        return $this->plan?->max_storage_gb ?? 1;
    }

    public function getMaxVideoLengthSec(): int
    {
        return $this->plan?->max_video_length_sec ?? 300;
    }

    public function getCurrentUserCount(): int
    {
        return $this->users()->count();
    }

    public function getActivitylogOptions(): \Spatie\Activitylog\LogOptions
    {
        return \Spatie\Activitylog\LogOptions::defaults()
            ->logOnly(['name', 'plan_tier', 'plan_id', 'is_active'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
