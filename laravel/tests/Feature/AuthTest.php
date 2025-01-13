<?php

use App\Enums\UserRole;
use App\Filament\Auth;
use Filament\Facades\Filament;
use Filament\Pages\Auth\Login;

use function Pest\Livewire\livewire;

covers(Auth\AdminLogin::class, Auth\UserLogin::class);

beforeEach(function () {
    $this->user = createUser(UserRole::USER);
});

it('can render admin login page', function () {
    $this->get(route('filament.admin.auth.login'))
        ->assertSuccessful()
        ->assertSee('Admin Login');
})->skip();

it('can render user login page', function () {
    $this->get(route('filament.app.auth.login'))
        ->assertSuccessful()
        ->assertSee('User Login');
});

it('can render custom register page', function () {
    $this->get(route('filament.app.auth.register'))
        ->assertSuccessful()
        ->assertSee('Register');
});

it('will redirect to app login page if not authenticated', function () {
    $this->get(route('filament.admin.pages.dashboard'))->assertRedirect(route('filament.app.auth.login'));
})->skip();

it('cant login with invalid user role on admin login page', function () {
    Filament::setCurrentPanel(Filament::getPanel('admin'));

    livewire(Login::class)
        ->fillForm([
            'email' => $this->user->email,
            'password' => 'password',
        ])
        ->call('authenticate')
        ->assertHasFormErrors(['email']);

    $this->assertGuest();
});
