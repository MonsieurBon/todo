<?php

namespace App\Tests\Schema\Types\Mutation;

use App\Entity\ApiToken;
use App\Entity\User;
use App\Schema\Types\Mutation\DestroyTokenType;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Type\Definition\ResolveInfo;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

class DestroyTokenTypeTest extends TestCase
{
    public function testDestroyToken()
    {
        $user = new User();
        $apiToken = new ApiToken();
        $user->setApiToken($apiToken);

        /** @var EntityManager $em */
        $em = $this->createMock(EntityManager::class);
        $em->expects(self::once())->method('flush');

        /** @var Registry $doctrine */
        $doctrine = $this->createMock(Registry::class);
        $doctrine->method('getManager')->willReturn($em);

        /** @var TokenInterface $tokenInterface */
        $tokenInterface = $this->createMock(TokenInterface::class);
        $tokenInterface->method('getUser')->willReturn($user);

        /** @var TokenStorage $tokenStorage */
        $tokenStorage = $this->createMock(TokenStorage::class);
        $tokenStorage->method('getToken')->willReturn($tokenInterface);

        /** @var ResolveInfo $resolveInfo */
        $resolveInfo = $this->createMock(ResolveInfo::class);
        $resolveInfo->fieldName = 'success';

        $destroyTokenType = new DestroyTokenType($doctrine, $tokenStorage);

        $successResolveFn = $destroyTokenType->config['fields']['success']['resolve'];
        call_user_func($successResolveFn, null, null, null, $resolveInfo);

        self::assertNotNull($apiToken->getValidUntil());
        self::assertLessThan(new \DateTime('now'), $apiToken->getValidUntil());
    }
}
