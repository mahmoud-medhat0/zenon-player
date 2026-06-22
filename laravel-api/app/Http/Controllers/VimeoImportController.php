<?php

namespace App\Http\Controllers;

use App\Jobs\ImportVimeoVideoJob;
use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class VimeoImportController extends Controller
{
    public function getVideos(Request $request)
    {
        $tenant = $request->user()->tenant;
        $vimeoToken = $request->vimeo_access_token ?? $tenant->vimeo_access_token ?? config('video.vimeo.access_token');

        if (!$vimeoToken) {
            return response()->json(['message' => 'No Vimeo Access Token available.'], 422);
        }

        if ($request->vimeo_access_token && $request->save_token) {
            $tenant->update(['vimeo_access_token' => $vimeoToken]);
        }

        $page = $request->input('page', 1);

        $response = Http::withToken($vimeoToken)
            ->get("https://api.vimeo.com/me/videos", [
                'page' => $page,
                'per_page' => 100,
                'fields' => 'uri,name,duration,files,pictures',
            ]);

        if (!$response->successful()) {
            return response()->json(['message' => 'Failed to fetch from Vimeo API. Check your token.'], 422);
        }

        $videosData = $response->json('data');
        $paging = $response->json('paging');

        $formattedVideos = [];

        foreach ($videosData as $vimeoVideo) {
            $title = $vimeoVideo['name'] ?? 'Untitled Video';
            $duration = $vimeoVideo['duration'] ?? 0;
            $files = $vimeoVideo['files'] ?? [];
            $pictures = $vimeoVideo['pictures']['sizes'] ?? [];

            $mp4Url = null;
            $highestWidth = 0;
            foreach ($files as $file) {
                if (($file['type'] === 'video/mp4' || $file['quality'] !== 'hls') && isset($file['link']) && $file['link']) {
                    $width = $file['width'] ?? 0;
                    if ($width > $highestWidth) {
                        $highestWidth = $width;
                        $mp4Url = $file['link'];
                    }
                }
            }

            if (!$mp4Url) {
                continue;
            }

            $thumbnailUrl = null;
            if (count($pictures) > 0) {
                $thumbnailUrl = end($pictures)['link'] ?? null;
            }

            $formattedVideos[] = [
                'id' => $vimeoVideo['uri'],
                'title' => $title,
                'duration' => $duration,
                'thumbnail' => $thumbnailUrl,
                'mp4_url' => $mp4Url,
            ];
        }

        return response()->json([
            'videos' => $formattedVideos,
            'has_more' => isset($paging['next']) && $paging['next'],
        ]);
    }

    public function importVideos(Request $request)
    {
        $tenant = $request->user()->tenant;

        $request->validate([
            'videos' => 'required|array',
            'videos.*.title' => 'required|string',
            'videos.*.duration' => 'required|numeric',
            'videos.*.mp4_url' => 'required|url',
        ]);

        $importedCount = 0;

        foreach ($request->videos as $videoData) {
            $videoRecord = Video::create([
                'tenant_id' => $tenant->id,
                'title' => $videoData['title'],
                'status' => 'processing',
                'privacy' => 'private',
                'duration_seconds' => $videoData['duration'],
                'size_bytes' => 0,
            ]);

            ImportVimeoVideoJob::dispatch($videoRecord, $videoData['mp4_url']);
            $importedCount++;
        }

        return response()->json([
            'message' => "Successfully queued {$importedCount} videos for import.",
        ]);
    }
}
