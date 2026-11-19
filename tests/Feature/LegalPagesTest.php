<?php

use Inertia\Testing\AssertableInertia as Assert;

it('shows the requested legal document to guests', function (string $document) {
    $this->get(route($document))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('frontend/legal')
            ->where('document', $document));
})->with(['terms', 'privacy']);
