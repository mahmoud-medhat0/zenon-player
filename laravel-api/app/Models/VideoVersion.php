<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class VideoVersion extends Model
{
    use HasUuids;

    protected $fillable = [
        'video_id',
        'resolution',
        'bitrate',
        'storage_path',
        'storage_disk',
    ];

    public function video()
    {
        return $this->belongsTo(Video::class);
    }
}
