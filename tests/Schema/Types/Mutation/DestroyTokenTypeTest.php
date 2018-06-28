<?php

namespace App\Tests\Schema\Types\Mutation;

use App\Entity\ApiToken;
use App\Schema\Types\Mutation\DestroyTokenType;
use App\Security\ApiKeyAuthenticatedToken;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Type\Definition\ResolveInfo;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;

class DestroyTokenTypeTest extends TestCase
{
    const TOKEN = 'abc123';

    public function testDestroyToken()
    {
        $apiToken = new ApiToken();
        $apiToken->setToken(self::TOKEN);

        /** @var EntityManager $em */
        $em = $this->createMock(EntityManager::class);
        $em->expects(self::once())->method('flush');

        /** @var Registry $doctrine */
        $doctrine = $this->createMock(Registry::class);
        $doctrine->method('getManager')->willReturn($em);

        /** @var ApiKeyAuthenticatedToken $apiKeyAuthenticatedToken */
        $apiKeyAuthenticatedToken = $this->createMock(ApiKeyAuthenticatedToken::class);
        $apiKeyAuthenticatedToken->method('getApiToken')->willReturn($apiToken);

        /** @var TokenStorage $tokenStorage */
        $tokenStorage = $this->createMock(TokenStorage::class);
        $tokenStorage->method('getToken')->willReturn($apiKeyAuthenticatedToken);

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
