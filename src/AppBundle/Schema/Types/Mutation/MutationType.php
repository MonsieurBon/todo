<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 28.09.17
 * Time: 07:06
 */

namespace AppBundle\Schema\Types\Mutation;


use AppBundle\Entity\Task;
use AppBundle\Entity\Tasklist;
use AppBundle\Schema\Types;
use AppBundle\Security\TasklistVoter;
use AppBundle\Security\TaskVoter;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class MutationType extends ObjectType
{
    const DESCRIPTION_FIELD_NAME = 'description';
    const DUEDATE_FIELD_NAME = 'duedate';
    const STARTDATE_FIELD_NAME = 'startdate';
    const TASK_ID_FIELD_NAME = 'taskid';
    const TASKLIST_ID_FIELD_NAME = 'tasklist';
    const TITLE_FIELD_NAME = 'title';
    const TOKEN_FIELD_NAME = 'token';
    const TYPE_FIELD_NAME = 'type';

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
                'createTasklist' => [
                    'type' => Types::createTasklist($doctrine, $tokenStorage),
                    'resolve' => function() {
                        return $this->createTasklist();
                    }
                ],
                'addTask' => [
                    'type' => Types::addTask($authChecker, $doctrine),
                    'args' => [
                        self::TASKLIST_ID_FIELD_NAME => Types::nonNull(Types::id())
                    ],
                    'resolve' => function($val, $args) {
                        return $this->addTask($args);
                    }
                ],
                'deleteTask' => [
                    'type' => Types::string(),
                    'args' => [
                        self::TASK_ID_FIELD_NAME => Types::nonNull(Types::id())
                    ],
                    'resolve' => function($val, $args) {
                        return $this->deleteTask($args);
                    }
                ],
                'destroyToken' => Types::destroyToken($doctrine, $tokenStorage)
            ]
        ];
        parent::__construct($config);
    }

    private function createTasklist() {
        return new Tasklist();
    }

    private function addTask($args)
    {
        $tasklistid = $args[self::TASKLIST_ID_FIELD_NAME];
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

    private function deleteTask($args)
    {
        $taskid = $args[self::TASK_ID_FIELD_NAME];
        $task = $this->em->getRepository(Task::class)->find($taskid);

        if ($task !== null && $this->authChecker->isGranted(TaskVoter::ACCESS, $task)) {
            $this->em->remove($task);
            $this->em->flush();

            return sprintf('Task with id=%d successfully deleted.', $taskid);
        }

        throw new Error(
            sprintf(
                'Task with id=%d not found!',
                $taskid
            )
        );
    }
}