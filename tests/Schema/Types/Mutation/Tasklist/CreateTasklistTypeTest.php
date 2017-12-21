<?php

namespace App\Tests\Schema\Types\Mutation\Tasklist;

use App\Entity\Tasklist;
use App\Entity\User;
use App\Schema\Types\Mutation\Tasklist\CreateTasklistType;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

class CreateTasklistTypeTest extends TestCase
{
    public function testCreateTasklist()
    {
        $user = new User();

        /** @var EntityManager $em */
        $em = $this->createMock(EntityManager::class);
        $em->expects(self::once())->method('persist')->with(self::isInstanceOf(Tasklist::class));
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

        $createTasklistType = new CreateTasklistType($doctrine, $tokenStorage);

        $tasklistResolveFn = $createTasklistType->config['fields']['tasklist']['resolve'];

        $tasklist = call_user_func($tasklistResolveFn, null, ['name' => 'tasklistName']);

        self::assertEquals('tasklistName', $tasklist->getName());
        self::assertEquals($user, $tasklist->getOwner());
    }
}
