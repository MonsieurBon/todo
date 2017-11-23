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
    const TASKLIST_FIELD_NAME = 'tasklist';
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
                'addTask' => [
                    'type' => Types::task(),
                    'args' => [
                        self::TITLE_FIELD_NAME => Types::nonNull(Types::string()),
                        self::DESCRIPTION_FIELD_NAME => Types::string(),
                        self::TYPE_FIELD_NAME => Types::nonNull(Types::taskTypeEnum()),
                        self::STARTDATE_FIELD_NAME => Types::nonNull(Types::date()),
                        self::DUEDATE_FIELD_NAME => Types::date(),
                        self::TASKLIST_FIELD_NAME => Types::nonNull(Types::id())
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

    /** @noinspection PhpUnusedPrivateMethodInspection */
    private function addTask($args)
    {
        $tasklistid = $args[self::TASKLIST_FIELD_NAME];
        $tasklist = $this->em->getRepository(TaskList::class)->find($tasklistid);

        if ($tasklist !== null && $this->authChecker->isGranted(TasklistVoter::ACCESS, $tasklist)) {
            $task = new Task();
            $task->setTitle($args[self::TITLE_FIELD_NAME]);
            if (array_key_exists(self::DESCRIPTION_FIELD_NAME, $args)) {
                $task->setDescription($args[self::DESCRIPTION_FIELD_NAME]);
            }
            $task->setType($args[self::TYPE_FIELD_NAME]);
            $task->setStartDate($args[self::STARTDATE_FIELD_NAME]);
            if (array_key_exists(self::DUEDATE_FIELD_NAME, $args)) {
                $task->setDueDate($args[self::DUEDATE_FIELD_NAME]);
            }
            $task->setTasklist($tasklist);

            $this->em->persist($task);
            $this->em->flush();

            return $task;
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