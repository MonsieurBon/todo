<?php

namespace AppBundle\Schema\Types\Mutation\Tasklist;


use AppBundle\Entity\Tasklist;
use AppBundle\Entity\User;
use AppBundle\Schema\Schema;
use AppBundle\Schema\Types;
use AppBundle\Security\TasklistVoter;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class DeleteTasklistType extends ObjectType
{
    /** @var  AuthorizationCheckerInterface */
    private $authChecker;
    /** @var  EntityManager */
    private $em;
    /** @var  TokenInterface */
    private $tokenInterface;

    public function __construct(AuthorizationCheckerInterface $authChecker, Registry $doctrine, TokenStorage $tokenStorage)
    {
        $this->authChecker = $authChecker;
        $this->em = $doctrine->getManager();
        $this->tokenInterface = $tokenStorage->getToken();

        $config = [
            'name' => 'DeleteTasklist',
            'fields' => [
                'tasklist' => [
                    'type' => Types::tasklist(),
                    'args' => [
                        Schema::TASKLIST_ID_FIELD_NAME => Types::nonNull(Types::id())
                    ],
                    'resolve' => function($val, $args) {
                        return $this->deleteTasklist($args);
                    }
                ]
            ]
        ];
        parent::__construct($config);
    }

    private function deleteTasklist($args)
    {
        $tasklistid = $args[Schema::TASKLIST_ID_FIELD_NAME];
        $tasklist = $this->em->getRepository(Tasklist::class)->find($tasklistid);

        if ($tasklist !== null) {
            if ($this->authChecker->isGranted(TasklistVoter::OWNER, $tasklist)) {
                $this->em->remove($tasklist);
                $this->em->flush();
            } else if ($this->authChecker->isGranted(TasklistVoter::ACCESS, $tasklist)) {
                /** @var User $user */
                $user = $this->tokenInterface->getUser();
                $tasklist->removeUser($user);
                $this->em->flush();
            }
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