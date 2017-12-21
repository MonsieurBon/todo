<?php

namespace App\Tests\Entity;

use App\Entity\ApiToken;
use PHPUnit\Framework\TestCase;

class ApiTokenTest extends TestCase
{
    public function testGetterAndSetter()
    {
        $validUntil = new \DateTime('now');
        $tokenString = '1234567890';

        $token = (new ApiToken())
            ->setToken($tokenString)
            ->setValidUntil($validUntil);

        $this->assertNull($token->getId());
        $this->assertRegExp('/^[a-z0-9]{32}$/', $token->getSalt());
        $this->assertEquals(hash('sha512', $token->getSalt() . $tokenString), $token->getToken());
        $this->assertEquals($validUntil, $token->getValidUntil());
    }
}
