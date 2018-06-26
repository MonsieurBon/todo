<?php

namespace App\Tests\Entity;

use App\Entity\ApiToken;
use App\Entity\User;
use PHPUnit\Framework\TestCase;

class UserTest extends TestCase
{
    public function testSimpleGetterAndSetter()
    {
        $user = (new User())
            ->setFirstname('Foo')
            ->setName('Bar')
            ->setEmail('foo@bar.ch')
            ->setUsername('foo')
            ->setPassword('a1b2c3d4e5');

        self::assertNull($user->getId());
        self::assertEquals('Foo', $user->getFirstname());
        self::assertEquals('Bar', $user->getName());
        self::assertEquals('foo@bar.ch', $user->getEmail());
        self::assertEquals('foo', $user->getUsername());
        self::assertEquals('a1b2c3d4e5', $user->getPassword());
        self::assertNull($user->getSalt());
        self::assertEquals(['ROLE_USER'], $user->getRoles());
    }

    public function testGetterAndSetterForToken()
    {
        $user1 = new User();
        $user2 = new User();

        $token1 = new ApiToken();
        $token2 = new ApiToken();

        $user1->addApiToken($token1);
        self::assertTrue($user1->getApiTokens()->contains($token1));
        self::assertEquals($user1, $token1->getUser());

        $user2->addApiToken($token1);
        self::assertTrue($user1->getApiTokens()->isEmpty());
        self::assertTrue($user2->getApiTokens()->contains($token1));
        self::assertEquals($user2, $token1->getUser());

        $user2->addApiToken($token2);
        self::assertEquals($token1->getUser(), $token2->getUser());
        self::assertTrue($user2->getApiTokens()->contains($token2));
        self::assertEquals($user2, $token2->getUser());
    }

    public function testEraseCredentialsDoesNothing()
    {
        $user = (new User())
            ->setFirstname('Foo')
            ->setName('Bar')
            ->setEmail('foo@bar.ch')
            ->setUsername('foo')
            ->setPassword('a1b2c3d4e5');

        $user->eraseCredentials();

        self::assertNull($user->getId());
        self::assertEquals('Foo', $user->getFirstname());
        self::assertEquals('Bar', $user->getName());
        self::assertEquals('foo@bar.ch', $user->getEmail());
        self::assertEquals('foo', $user->getUsername());
        self::assertEquals('a1b2c3d4e5', $user->getPassword());
        self::assertNull($user->getSalt());
        self::assertEquals(['ROLE_USER'], $user->getRoles());
    }
}
