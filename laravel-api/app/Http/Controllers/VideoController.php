<?php

namespace App\Http\Controllers;

use App\Models\Video;
use App\Services\BunnyVideoStatusService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;

#[OA\Info(version: "1.0.0", title: "Stream Video Platform Mobile API")]
#[OA\Server(url: L5_SWAGGER_CONST_HOST, description: "API Server")]
#[OA\SecurityScheme(securityScheme: "bearerAuth", type: "http", scheme: "bearer")]
class VideoController extends Controller
{
    public function index(Request $request, BunnyVideoStatusService $bunnyVideos)
    {
        $videos = Video::latest()->paginate(20);
        
        // Real-time Bunny Stream Sync (Lazy check on dashboard load/poll)
        foreach ($videos as $video) {
            if ($video->status === 'processing' && $video->bunny_video_id) {
                $bunnyVideos->syncFromBunny($video);
            }
        }

        $videos->getCollection()->transform(function($video) {
            $thumbnail = null;
            if ($video->cloudflare_uid) {
                $cfDomain = env('CLOUDFLARE_CUSTOMER_DOMAIN', 'customer-zetj589d76kngmjr.cloudflarestream.com');
                $thumbnail = "https://{$cfDomain}/{$video->cloudflare_uid}/thumbnails/thumbnail.jpg";
            } elseif ($video->bunny_video_id) {
                $bunnyDomain = config('video.bunny.pull_zone');
                $thumbnail = "https://{$bunnyDomain}/{$video->bunny_video_id}/thumbnail.jpg";
            } elseif ($video->status === 'ready') {
                $thumbnail = url("/api/videos/{$video->id}/thumbnail");
            }

            return [
                'id' => $video->id,
                'title' => $video->title,
                'status' => $video->status,
                'views' => $video->views,
                'date' => $video->created_at->diffForHumans(),
                'created_at' => $video->created_at->toISOString(),
                'duration' => $video->duration_seconds ? gmdate($video->duration_seconds >= 3600 ? "H:i:s" : "i:s", $video->duration_seconds) : '--:--',
                'thumbnail' => $thumbnail,
            ];
        });

        return response()->json($videos);
    }

    #[OA\Get(path: "/public/videos/{id}", summary: "Get public video metadata and tenant branding", tags: ["Mobile App Integration"])]
    #[OA\Parameter(name: "id", in: "path", required: true, description: "UUID of the video", schema: new OA\Schema(type: "string"))]
    #[OA\Response(response: 200, description: "Successful operation", content: new OA\JsonContent(
        properties: [
            new OA\Property(property: "id", type: "string"),
            new OA\Property(property: "title", type: "string"),
            new OA\Property(property: "duration", type: "integer", nullable: true),
            new OA\Property(property: "views", type: "integer"),
            new OA\Property(property: "privacy", type: "string"),
            new OA\Property(property: "thumbnail_url", type: "string"),
            new OA\Property(property: "stream_url", type: "string"),
            new OA\Property(property: "branding", type: "object", properties: [
                new OA\Property(property: "primary_color", type: "string", nullable: true),
                new OA\Property(property: "logo_url", type: "string", nullable: true)
            ])
        ]
    ))]
    #[OA\Response(response: 403, description: "Forbidden")]
    #[OA\Response(response: 404, description: "Not Found")]
    public function publicShow($id, BunnyVideoStatusService $bunnyVideos)
    {
        $video = Video::with('tenant')->findOrFail($id);

        if ($video->status === 'processing' && $video->bunny_video_id) {
            $bunnyVideos->syncFromBunny($video);
            $video = $video->fresh('tenant') ?? $video;
        }

        if ($video->privacy === 'private' && !auth('sanctum')->check()) {
            abort(403, 'This video is private.');
        }

        $thumbnailUrl = null;
        $streamUrl = null;

        if ($video->cloudflare_uid) {
            $cfDomain = env('CLOUDFLARE_CUSTOMER_DOMAIN', 'customer-zetj589d76kngmjr.cloudflarestream.com');
            $thumbnailUrl = "https://{$cfDomain}/{$video->cloudflare_uid}/thumbnails/thumbnail.jpg";
            if ($video->status === 'ready') {
                $streamUrl = "https://{$cfDomain}/{$video->cloudflare_uid}/manifest/video.m3u8";
            }
        } elseif ($video->bunny_video_id) {
            $bunnyDomain = config('video.bunny.pull_zone');
            $thumbnailUrl = "https://{$bunnyDomain}/{$video->bunny_video_id}/thumbnail.jpg";
            if ($video->status === 'ready') {
                $streamUrl = $this->getBunnyStreamUrl($video->bunny_video_id, $bunnyDomain);
            }
        } elseif ($video->status === 'ready') {
            $thumbnailUrl = url("/api/videos/{$video->id}/thumbnail");
            $streamUrl = url("/api/videos/{$video->id}/stream/playlist.m3u8");
        }

        return response()->json([
            'id' => $video->id,
            'title' => $video->title,
            'duration' => $video->duration_seconds,
            'views' => $video->views,
            'privacy' => $video->privacy,
            'status' => $video->status,
            'thumbnail_url' => $thumbnailUrl,
            'stream_url' => $streamUrl,
            'branding' => [
                'primary_color' => $video->tenant->primary_color,
                'logo_url' => $video->tenant->logo_url,
            ]
        ]);
    }

    #[OA\Get(path: "/videos/{id}/thumbnail", summary: "Get video thumbnail", tags: ["Mobile App Integration"])]
    #[OA\Parameter(name: "id", in: "path", required: true, description: "UUID of the video", schema: new OA\Schema(type: "string"))]
    #[OA\Response(response: 200, description: "Image binary data")]
    #[OA\Response(response: 403, description: "Forbidden")]
    #[OA\Response(response: 404, description: "Not Found")]
    public function thumbnail($id)
    {
        $video = Video::findOrFail($id);

        if ($video->privacy === 'private' && !auth('sanctum')->check()) {
            abort(403, 'This video is private.');
        }

        if ($video->cloudflare_uid) {
            $cfDomain = env('CLOUDFLARE_CUSTOMER_DOMAIN', 'customer-zetj589d76kngmjr.cloudflarestream.com');
            return redirect("https://{$cfDomain}/{$video->cloudflare_uid}/thumbnails/thumbnail.jpg");
        } elseif ($video->bunny_video_id) {
            $bunnyDomain = config('video.bunny.pull_zone');
            return redirect("https://{$bunnyDomain}/{$video->bunny_video_id}/thumbnail.jpg");
        }

        $path = "videos/{$video->tenant_id}/{$video->id}_data/thumbnail.jpg";
        
        if (Storage::disk('local')->exists($path)) {
            return response()->file(storage_path("app/private/" . $path));
        }
        
        return response()->json(['message' => 'Not found'], 404);
    }

    public function uploadThumbnail(Request $request, $id)
    {
        $video = Video::findOrFail($id);

        $request->validate([
            'thumbnail' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        if ($request->hasFile('thumbnail')) {
            $file = $request->file('thumbnail');
            $path = "videos/{$video->tenant_id}/{$video->id}_data/thumbnail.jpg";
            
            Storage::disk('local')->putFileAs(
                dirname($path), 
                $file, 
                'thumbnail.jpg'
            );

            // Using timestamp hack to bust frontend cache
            $video->touch(); 

            return response()->json([
                'message' => 'Thumbnail uploaded successfully', 
                'thumbnail_url' => url("/api/videos/{$video->id}/thumbnail?t=" . time())
            ]);
        }

        return response()->json(['message' => 'Upload failed'], 400);
    }

    public function update(Request $request, $id)
    {
        $video = Video::findOrFail($id);

        $rules = [
            'title' => 'required|string|max:255',
        ];

        $tenant = $request->user()->tenant()->with('plan')->first();
        if ($tenant && $tenant->hasFeature('privacy_controls')) {
            $rules['privacy'] = 'sometimes|in:private,public,unlisted';
        }

        $request->validate($rules);

        $data = ['title' => $request->title];

        if ($request->has('privacy')) {
            $data['privacy'] = $request->privacy;
        }

        $video->update($data);

        return response()->json(['message' => 'Video updated successfully', 'video' => $video]);
    }

    public function destroy($id)
    {
        $video = Video::findOrFail($id);

        if ($video->cloudflare_uid) {
            $accountId = config('video.cloudflare.account_id');
            $apiToken = config('video.cloudflare.api_token');
            if ($accountId && $apiToken) {
                try {
                    \Illuminate\Support\Facades\Http::withToken($apiToken)
                        ->withOptions(['verify' => false])
                        ->delete("https://api.cloudflare.com/client/v4/accounts/{$accountId}/stream/{$video->cloudflare_uid}");
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning('Failed to delete video from Cloudflare: ' . $e->getMessage());
                }
            }
        } elseif ($video->bunny_video_id) {
            $libraryId = config('video.bunny.library_id');
            $apiKey = config('video.bunny.api_key');
            if ($libraryId && $apiKey) {
                try {
                    \Illuminate\Support\Facades\Http::withHeaders(['AccessKey' => $apiKey])
                        ->delete("https://video.bunnycdn.com/library/{$libraryId}/videos/{$video->bunny_video_id}");
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning('Failed to delete video from Bunny Stream: ' . $e->getMessage());
                }
            }
        }

        Storage::disk('local')->deleteDirectory("videos/{$video->tenant_id}/{$video->id}_data");
        Storage::disk('local')->delete("videos/{$video->tenant_id}/{$video->id}.mp4");

        $video->delete();

        return response()->json(['message' => 'Video deleted successfully']);
    }

    #[OA\Get(path: "/videos/{id}/stream/{file}", summary: "Stream video file (HLS)", tags: ["Mobile App Integration"])]
    #[OA\Parameter(name: "id", in: "path", required: true, description: "UUID of the video", schema: new OA\Schema(type: "string"))]
    #[OA\Parameter(name: "file", in: "path", required: true, description: "Filename (e.g. playlist.m3u8)", schema: new OA\Schema(type: "string"))]
    #[OA\Response(response: 200, description: "HLS Manifest or TS Chunk")]
    #[OA\Response(response: 403, description: "Forbidden")]
    #[OA\Response(response: 404, description: "Not Found")]
    public function stream($id, $file)
    {
        $video = Video::findOrFail($id);
        
        if ($video->privacy === 'private' && !auth('sanctum')->check()) {
            abort(403, 'This video is private.');
        }

        if ($video->cloudflare_uid && basename($file) === 'playlist.m3u8') {
            $cfDomain = env('CLOUDFLARE_CUSTOMER_DOMAIN', 'customer-zetj589d76kngmjr.cloudflarestream.com');
            return redirect("https://{$cfDomain}/{$video->cloudflare_uid}/manifest/video.m3u8");
        } elseif ($video->bunny_video_id && basename($file) === 'playlist.m3u8') {
            $bunnyDomain = config('video.bunny.pull_zone');
            return redirect("https://{$bunnyDomain}/{$video->bunny_video_id}/playlist.m3u8");
        }

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

    /**
     * Generate a securely signed Bunny Stream URL
     */
    protected function getBunnyStreamUrl($videoId, $domain)
    {
        $securityKey = config('video.bunny.security_key');
        
        if (!$securityKey) {
            return "https://{$domain}/{$videoId}/playlist.m3u8";
        }

        $expires = time() + 7200; // 2 hours expiration
        $path = "/{$videoId}/playlist.m3u8";

        // Hashable string: SecurityKey + Path + Expires
        $hashableBase = $securityKey . $path . $expires;
        
        $hash = hash('sha256', $hashableBase, true);
        
        $token = strtr(base64_encode($hash), '+/', '-_');
        $token = str_replace('=', '', $token);

        return "https://{$domain}/{$videoId}/playlist.m3u8?token={$token}&expires={$expires}";
    }
}
