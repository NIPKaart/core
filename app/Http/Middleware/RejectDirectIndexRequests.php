<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RejectDirectIndexRequests
{
    /**
     * Check the original URI because the web server may expose index.php as the request's base URL.
     *
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (explode('?', $request->getRequestUri(), 2)[0] === '/index.php') {
            abort(404);
        }

        return $next($request);
    }
}
