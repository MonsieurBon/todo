<?php

namespace tests\AppBundle\Entity;


use AppBundle\Entity\ApiToken;
use AppBundle\Entity\User;
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

        $this->assertNull($user->getId());
        $this->assertEquals('Foo', $user->getFirstname());
        $this->assertEquals('Bar', $user->getName());
        $this->assertEquals('foo@bar.ch', $user->getEmail());
        $this->assertEquals('foo', $user->getUsername());
        $this->assertEquals('a1b2c3d4e5', $user->getPassword());
        $this->assertNull($user->getSalt());
        $this->assertEquals(array('ROLE_USER'), $user->getRoles());
    }

    public function testGetterAndSetterForToken()
    {
        $user1 = new User();
        $user2 = new User();

        $token1 = new ApiToken();
        $token2 = new ApiToken();

        $user1->setApiToken($token1);
        $this->assertEquals($token1, $user1->getApiToken());
        $this->assertEquals($user1, $token1->getUser());

        $user2->setApiToken($token1);
        $this->assertNull($user1->getApiToken());
        $this->assertEquals($token1, $user2->getApiToken());
        $this->assertEquals($user2, $token1->getUser());

        $user2->setApiToken($token2);
        $this->assertNull($token1->getUser());
        $this->assertEquals($token2, $user2->getApiToken());
        $this->assertEquals($user2, $token2->getUser());
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

        $this->assertNull($user->getId());
        $this->assertEquals('Foo', $user->getFirstname());
        $this->assertEquals('Bar', $user->getName());
        $this->assertEquals('foo@bar.ch', $user->getEmail());
        $this->assertEquals('foo', $user->getUsername());
        $this->assertEquals('a1b2c3d4e5', $user->getPassword());
        $this->assertNull($user->getSalt());
        $this->assertEquals(array('ROLE_USER'), $user->getRoles());
    }

    public function testSerialize()
    {
        $user = (new User())
            ->setEmail('foo@bar.ch')
            ->setUsername('foo')
            ->setPassword('a1b2c3d4e5');

        $serialize = $user->serialize();
        $this->assertEquals('a:4:{i:0;N;i:1;s:3:"foo";i:2;s:10:"foo@bar.ch";i:3;s:10:"a1b2c3d4e5";}', $serialize);
    }

    public function testUnserialize()
    {
        $user = new User();
        $user->unserialize('a:4:{i:0;N;i:1;s:3:"foo";i:2;s:10:"foo@bar.ch";i:3;s:10:"a1b2c3d4e5";}');

        $this->assertNull($user->getId());
        $this->assertEquals('foo@bar.ch', $user->getEmail());
        $this->assertEquals('foo', $user->getUsername());
        $this->assertEquals('a1b2c3d4e5', $user->getPassword());
    }
}