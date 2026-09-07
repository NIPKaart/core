<?php

namespace Tests\Support;

use CBOR\ByteStringObject;
use CBOR\MapObject;
use CBOR\NegativeIntegerObject;
use CBOR\TextStringObject;
use CBOR\UnsignedIntegerObject;
use OpenSSLAsymmetricKey;
use ParagonIE\ConstantTime\Base64UrlSafe;

/** A software ES256 authenticator exercising the real WebAuthn validators. */
class VirtualPasskey
{
    private OpenSSLAsymmetricKey $key;

    private string $id;

    private int $counter = 0;

    public function __construct(?OpenSSLAsymmetricKey $key = null)
    {
        $this->key = $key ?? openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        $this->id = random_bytes(32);
    }

    public function register(array $options, string $origin): array
    {
        $details = openssl_pkey_get_details($this->key)['ec'];
        $cose = MapObject::create()
            ->add(UnsignedIntegerObject::create(1), UnsignedIntegerObject::create(2))
            ->add(UnsignedIntegerObject::create(3), NegativeIntegerObject::create(-7))
            ->add(NegativeIntegerObject::create(-1), UnsignedIntegerObject::create(1))
            ->add(NegativeIntegerObject::create(-2), ByteStringObject::create(str_pad($details['x'], 32, "\0", STR_PAD_LEFT)))
            ->add(NegativeIntegerObject::create(-3), ByteStringObject::create(str_pad($details['y'], 32, "\0", STR_PAD_LEFT)));
        $data = hash('sha256', $options['rp']['id'], true).chr(0x45).pack('N', 0)
            .str_repeat(chr(0), 16).pack('n', strlen($this->id)).$this->id.(string) $cose;
        $attestation = MapObject::create()
            ->add(TextStringObject::create('fmt'), TextStringObject::create('none'))
            ->add(TextStringObject::create('attStmt'), MapObject::create())
            ->add(TextStringObject::create('authData'), ByteStringObject::create($data));

        return $this->credential([
            'clientDataJSON' => $this->clientData('webauthn.create', $options['challenge'], $origin),
            'attestationObject' => Base64UrlSafe::encodeUnpadded((string) $attestation),
            'transports' => ['internal'],
        ]);
    }

    public function sign(array $options, string $origin, string $userHandle, bool $verified = true): array
    {
        $client = $this->clientData('webauthn.get', $options['challenge'], $origin);
        $data = hash('sha256', $options['rpId'], true).chr($verified ? 0x05 : 0x01).pack('N', ++$this->counter);
        openssl_sign($data.hash('sha256', Base64UrlSafe::decodeNoPadding($client), true), $signature, $this->key, OPENSSL_ALGO_SHA256);

        return $this->credential([
            'clientDataJSON' => $client,
            'authenticatorData' => Base64UrlSafe::encodeUnpadded($data),
            'signature' => Base64UrlSafe::encodeUnpadded($signature),
            'userHandle' => $userHandle,
        ]);
    }

    private function clientData(string $type, string $challenge, string $origin): string
    {
        return Base64UrlSafe::encodeUnpadded(json_encode(compact('type', 'challenge', 'origin') + ['crossOrigin' => false], JSON_THROW_ON_ERROR));
    }

    private function credential(array $response): array
    {
        return ['id' => Base64UrlSafe::encodeUnpadded($this->id), 'rawId' => Base64UrlSafe::encodeUnpadded($this->id),
            'type' => 'public-key', 'response' => $response, 'clientExtensionResults' => (object) []];
    }
}
