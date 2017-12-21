<?php

namespace App\Schema\Types\Mutation;

use App\Entity\Tasklist;
use App\Schema\Schema;
use App\Schema\Types;
use App\Security\TasklistVoter;
use Doctrine\ORM\EntityManager;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class MutationType extends ObjectType
{
    /** @var AuthorizationCheckerInterface */
    private $authChecker;
    /** @var EntityManager */
    private $em;
    /** @var TokenStorageInterface */
    private $tokenStorage;

    public function __construct(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine, TokenStorageInterface $tokenStorage)
    {
        $this->authChecker = $authChecker;
        $this->em = $doctrine->getManager();
        $this->tokenStorage = $tokenStorage;

        $config = [
            'name' => 'Mutation',
            'fields' => [
                'createTasklist' => Types::createTasklist($doctrine, $tokenStorage),
                'deleteTaskList' => Types::deleteTasklist($authChecker, $doctrine, $tokenStorage),
                'shareTasklist' => Types::shareTasklist($authChecker, $doctrine),
                'addTask' => [
                    'type' => Types::addTask($authChecker, $doctrine),
                    'args' => [
                        Schema::TASKLIST_ID_FIELD_NAME => Types::nonNull(Types::id())
                    ],
                    'resolve' => function ($val, $args) {
                        return $this->addTask($args);
                    }
                ],
                'deleteTask' => Types::deleteTask($authChecker, $doctrine),
                'destroyToken' => Types::destroyToken($doctrine, $tokenStorage)
            ],
            'resolveField' => function () {
                return [];
            }
        ];
        parent::__construct($config);
    }

    private function addTask($args)
    {
        $tasklistid = $args[Schema::TASKLIST_ID_FIELD_NAME];
        $tasklist = $this->em->getRepository(TaskList::class)->find($tasklistid);

        if ($tasklist !== null && $this->authChecker->isGranted(TasklistVoter::ACCESS, $tasklist)) {
            return $tasklist;
        }

        throw new Error(
            sprintf(
                'Tasklist with id=%d not found!',
                $tasklistid
            )
        );
    }
}
