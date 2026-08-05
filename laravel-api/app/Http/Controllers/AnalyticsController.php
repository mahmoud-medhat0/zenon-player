<?php

namespace App\Http\Controllers;

use App\Models\Video;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function overview(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $videos = Video::where('tenant_id', $tenantId)->get();

        $totalVideos = $videos->count();
        $totalDuration = (int) $videos->sum('duration_seconds');
        $totalViews = (int) $videos->sum('views');
        $totalBytes = (int) $videos->sum('size_bytes');

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
            'total_duration' => $this->formatDuration($totalDuration),
            'storage_used' => $this->formatBytes($totalBytes),
            'recent_activity' => $recentActivity
        ]);
    }

    public function videoAnalytics(Request $request, string $id)
    {
        $tenantId = $request->user()->tenant_id;

        $video = Video::where('tenant_id', $tenantId)->find($id);

        if (!$video) {
            return response()->json(['message' => 'Video not found.'], 404);
        }

        $tenantViews = (int) Video::where('tenant_id', $tenantId)->sum('views');
        $views = (int) $video->views;
        $duration = (int) $video->duration_seconds;

        return response()->json([
            'id' => $video->id,
            'title' => $video->title,
            'status' => $video->status,
            'privacy' => $video->privacy,
            'views' => $views,
            'duration' => $this->formatDuration($duration),
            'duration_seconds' => $duration,
            'size_bytes' => (int) $video->size_bytes,
            'storage_used' => $this->formatBytes((int) $video->size_bytes),
            'share_of_views' => $tenantViews > 0 ? round(($views / $tenantViews) * 100, 2) : 0,
            'estimated_watch_time' => $this->formatDuration($views * $duration),
            'versions' => $video->versions()->count(),
            'created_at' => $video->created_at->toIso8601String(),
            'updated_at' => $video->updated_at->toIso8601String(),
        ]);
    }

    private function formatDuration(int $seconds): string
    {
        $seconds = max($seconds, 0);

        return $seconds >= 3600
            ? sprintf('%d:%02d:%02d', intdiv($seconds, 3600), intdiv($seconds % 3600, 60), $seconds % 60)
            : sprintf('%02d:%02d', intdiv($seconds, 60), $seconds % 60);
    }

    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = (int) floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);

        return round($bytes, 2) . ' ' . $units[$pow];
    }
}
