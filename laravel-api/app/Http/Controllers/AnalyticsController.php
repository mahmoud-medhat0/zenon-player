<?php

namespace App\Http\Controllers;

use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $videos = Video::where('tenant_id', $tenantId)->get();
        
        $totalVideos = $videos->count();
        $totalDuration = $videos->sum('duration_seconds');
        $totalViews = $videos->sum('views'); 
        
        $totalBytes = 0;
        $files = Storage::disk('local')->allFiles("videos/{$tenantId}");
        foreach ($files as $file) {
            $totalBytes += Storage::disk('local')->size($file);
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($totalBytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);
        $formattedStorage = round($bytes, 2) . ' ' . $units[$pow];

        $recentActivity = [];
        $latestVideos = Video::where('tenant_id', $tenantId)->latest()->take(3)->get();
        foreach ($latestVideos as $video) {
            $recentActivity[] = [
                'action' => 'Video Uploaded: ' . $video->title,
                'date' => $video->created_at->diffForHumans()
            ];
        }
        
        if (count($recentActivity) < 3) {
            $recentActivity[] = [
                'action' => 'Account Created', 
                'date' => $request->user()->created_at->diffForHumans()
            ];
        }

        return response()->json([
            'total_videos' => $totalVideos,
            'total_views' => $totalViews,
            'total_duration' => gmdate($totalDuration >= 3600 ? "H:i:s" : "i:s", $totalDuration),
            'storage_used' => $formattedStorage,
            'recent_activity' => $recentActivity
        ]);
    }
}
