<?php

namespace App\Http\Middleware;

use App\Enums\SupportedLocale;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

class HandleLocale
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $locale = SupportedLocale::parse($request->user()?->locale)
            ?? SupportedLocale::parse($request->cookie('locale'))
            ?? SupportedLocale::parse($request->getPreferredLanguage(array_column(SupportedLocale::cases(), 'value')))
            ?? SupportedLocale::default();

        App::setLocale($locale->value);

        return $next($request);
    }
}
