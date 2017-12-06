<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 28.09.17
 * Time: 07:06
 */

namespace AppBundle\Schema\Types\Mutation;


use AppBundle\Entity\Tasklist;
use AppBundle\Schema\Schema;
use AppBundle\Schema\Types;
use AppBundle\Security\TasklistVoter;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class MutationType extends ObjectType
{
    /** @var AuthorizationCheckerInterface  */
    private $authChecker;
    /** @var  EntityManager */
    private $em;
    /** @var TokenStorage  */
    private $tokenStorage;

    public function __construct(AuthorizationCheckerInterface $authChecker, Registry $doctrine, TokenStorage $tokenStorage)
    {
        $this->authChecker = $authChecker;
        $this->em = $doctrine->getManager();
        $this->tokenStorage = $tokenStorage;

        $config = [
            'name' => 'Mutation',
            'fields' => [
                'createTasklist' => Types::createTasklist($doctrine, $tokenStorage),
                'addTask' => [
                    'type' => Types::addTask($authChecker, $doctrine),
                    'args' => [
                        Schema::TASKLIST_ID_FIELD_NAME => Types::nonNull(Types::id())
                    ],
                    'resolve' => function($val, $args) {
                        return $this->addTask($args);
                    }
                ],
                'deleteTask' => Types::deleteTask($authChecker, $doctrine),
                'destroyToken' => Types::destroyToken($doctrine, $tokenStorage)
            ],
            'resolveField' => function () {
                return array();
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
