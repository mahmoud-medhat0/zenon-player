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
        'views',
        'size_bytes',
        'cloudflare_uid',
        'bunny_video_id',
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

    /**
     * A signed (or, if no security key is configured, plain) Bunny CDN URL
     * for this video, e.g. bunnySignedUrl('playlist.m3u8').
     */
    public function bunnySignedUrl(string $file): ?string
    {
        if (!$this->bunny_video_id) {
            return null;
        }

        $domain = config('video.bunny.pull_zone');

        if (!$domain) {
            return null;
        }

        $path = "/{$this->bunny_video_id}/{$file}";
        $securityKey = config('video.bunny.security_key');

        if (!$securityKey) {
            return "https://{$domain}{$path}";
        }

        $expires = time() + 7200; // 2 hours expiration
        $hash = hash('sha256', $securityKey . $path . $expires, true);
        $token = rtrim(strtr(base64_encode($hash), '+/', '-_'), '=');

        return "https://{$domain}{$path}?token={$token}&expires={$expires}";
    }
}
