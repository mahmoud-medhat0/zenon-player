<?php

namespace App\Http\Controllers;

use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class VideoController extends Controller
{
    public function index(Request $request)
    {
        $videos = Video::latest()->paginate(20);
        
        $videos->getCollection()->transform(function($video) {
            return [
                'id' => $video->id,
                'title' => $video->title,
                'status' => $video->status,
                'views' => $video->views,
                'date' => $video->created_at->diffForHumans(),
                'duration' => $video->duration_seconds ? gmdate($video->duration_seconds >= 3600 ? "H:i:s" : "i:s", $video->duration_seconds) : '--:--',
                'thumbnail' => $video->status === 'ready' 
                    ? url("/api/videos/{$video->id}/thumbnail")
                    : null,
            ];
        });

        return response()->json($videos);
    }

    public function thumbnail($id)
    {
        $video = Video::findOrFail($id);
        $path = "videos/{$video->tenant_id}/{$video->id}_data/thumbnail.jpg";
        
        if (Storage::disk('local')->exists($path)) {
            return response()->file(storage_path("app/private/" . $path));
        }
        
        return response()->json(['message' => 'Not found'], 404);
    }

    public function update(Request $request, $id)
    {
        $video = Video::findOrFail($id);
        
        $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $video->update([
            'title' => $request->title
        ]);

        return response()->json(['message' => 'Video updated successfully', 'video' => $video]);
    }

    public function destroy($id)
    {
        $video = Video::findOrFail($id);

        Storage::disk('local')->deleteDirectory("videos/{$video->tenant_id}/{$video->id}_data");
        Storage::disk('local')->delete("videos/{$video->tenant_id}/{$video->id}.mp4");

        $video->delete();

        return response()->json(['message' => 'Video deleted successfully']);
    }

    public function stream($id, $file)
    {
        $video = Video::findOrFail($id);
        
        $file = basename($file);
        
        $allowedExtensions = ['m3u8', 'ts'];
        $extension = pathinfo($file, PATHINFO_EXTENSION);
        if (!in_array($extension, $allowedExtensions)) {
            abort(403, 'Invalid file type');
        }
        
        $path = "videos/{$video->tenant_id}/{$video->id}_data/hls/{$file}";
        
        $realPath = realpath(storage_path("app/private/" . $path));
        $allowedDir = realpath(storage_path("app/private/videos/{$video->tenant_id}/{$video->id}_data/hls"));
        
        if ($realPath === false || $allowedDir === false || strpos($realPath, $allowedDir) !== 0) {
            abort(403, 'Access denied');
        }
        
        if (!Storage::disk('local')->exists($path)) {
            abort(404);
        }
        
        if ($file === 'playlist.m3u8') {
            $sessionKey = "video_view_{$video->id}";
            if (!session()->has($sessionKey)) {
                $video->increment('views');
                session()->put($sessionKey, true);
            }
        }
        
        $mime = 'application/vnd.apple.mpegurl';
        if (str_ends_with($file, '.ts')) {
            $mime = 'video/mp2t';
        }
        
        return response()->file(storage_path("app/private/" . $path), [
            'Content-Type' => $mime,
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
}
