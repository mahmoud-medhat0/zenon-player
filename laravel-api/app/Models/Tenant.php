<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'plan_tier',
    ];

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function videos()
    {
        return $this->hasMany(Video::class);
    }
}
