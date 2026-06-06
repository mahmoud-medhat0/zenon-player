<?php

namespace App\Http\Controllers;

use App\Models\Video;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class VideoController extends Controller
{
    public function index(Request $request)
    {
        $videos = Video::latest()->get();
        
        $videos->transform(function($video) {
            return [
                'id' => $video->id,
                'title' => $video->title,
                'status' => $video->status,
                'views' => '0',
                'date' => $video->created_at->diffForHumans(),
                'duration' => $video->duration_seconds ? gmdate($video->duration_seconds >= 3600 ? "H:i:s" : "i:s", $video->duration_seconds) : '--:--',
                'thumbnail' => $video->status === 'ready' 
                    ? "http://localhost:8000/api/videos/{$video->id}/thumbnail"
                    : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
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

        // Delete from storage
        Storage::disk('local')->deleteDirectory("videos/{$video->tenant_id}/{$video->id}_data");
        Storage::disk('local')->delete("videos/{$video->tenant_id}/{$video->id}.mp4");

        $video->delete();

        return response()->json(['message' => 'Video deleted successfully']);
    }

    public function stream($id, $file)
    {
        $video = Video::findOrFail($id);
        
        // Basic path traversal prevention
        $file = str_replace(['..', '\\', '//'], '', $file); 
        $path = "videos/{$video->tenant_id}/{$video->id}_data/hls/{$file}";
        
        if (!Storage::disk('local')->exists($path)) {
            abort(404);
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
