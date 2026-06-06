<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

use App\Traits\BelongsToTenant;

class Video extends Model
{
    use HasUuids, BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'title',
        'status',
        'privacy',
        'duration_seconds',
        'security_settings',
    ];

    protected $casts = [
        'security_settings' => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function versions()
    {
        return $this->hasMany(VideoVersion::class);
    }
}
