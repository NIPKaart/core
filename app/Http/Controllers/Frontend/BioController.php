<?php

namespace App\Http\Controllers\Frontend;

use App\Enums\SupportedLocale;
use App\Http\Controllers\Controller;
use App\Services\BioContent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class BioController extends Controller
{
    public function index(Request $request, BioContent $content): Response
    {
        $locale = SupportedLocale::parse(app()->getLocale()) ?? SupportedLocale::EN;
        $messages = File::json(resource_path("locales/frontend/{$locale->value}/bio.json"));
        $seo = [
            'title' => $messages['meta']['title'].' - '.config('app.name'),
            'description' => $messages['meta']['description'],
            'canonical' => route('bio'),
            'image' => asset('assets/images/bio/community-parking.webp'),
        ];
        $response = Inertia::render('frontend/bio', [
            ...$content->resolve(),
            'canonical' => $seo['canonical'],
            'socialImage' => $seo['image'],
        ])->withViewData(['bioMeta' => $seo])->toResponse($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
