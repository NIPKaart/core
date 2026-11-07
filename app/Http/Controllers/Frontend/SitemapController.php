<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\AreaPages;
use Illuminate\Http\Request;
use Spatie\Sitemap\Sitemap;
use Symfony\Component\HttpFoundation\Response;

class SitemapController extends Controller
{
    /**
     * Frontend - The public pages crawlers may index, including every area page with public parking (#1307).
     */
    public function __invoke(Request $request, AreaPages $areas): Response
    {
        return Sitemap::create()
            ->add([route('home'), route('location-map'), route('garages'), route('about'), route('contact'), ...$areas->indexableUrls()])
            ->toResponse($request);
    }
}
