<?php

it('returns a successful response', function () {
    $response = $this->get('/');

    $response->assertStatus(200)
        ->assertSee('data-page=', false)
        ->assertDontSee('data-server-rendered', false);
});
