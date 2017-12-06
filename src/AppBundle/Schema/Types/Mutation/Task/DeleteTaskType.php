<?php

namespace AppBundle\Schema\Types\Mutation\Task;


use AppBundle\Entity\Task;
use AppBundle\Schema\Schema;
use AppBundle\Schema\Types;
use AppBundle\Security\TaskVoter;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class DeleteTaskType extends ObjectType
{
    /** @var  EntityManager */
    private $em;
    /** @var  AuthorizationCheckerInterface */
    private $authChecker;

    public function __construct(AuthorizationCheckerInterface $authChecker, Registry $doctrine)
    {
        $this->em = $doctrine->getManager();
        $this->authChecker = $authChecker;

        $config = [
            'name' => 'DeleteTask',
            'fields' => [
                'task' => [
                    'type' => Types::task(),
                    'args' => [
                        Schema::TASK_ID_FIELD_NAME => Types::nonNull(Types::id())
                    ],
                    'resolve' => function($val, $args) {
                        return $this->deleteTask($args);
                    }
                ]
            ]
        ];
        parent::__construct($config);
    }

    /**
     * @param $args
     * @return Task|null|object
     * @throws Error
     */
    private function deleteTask($args)
    {
        $taskid = $args[Schema::TASK_ID_FIELD_NAME];
        $task = $this->em->getRepository(Task::class)->find($taskid);

        if ($task !== null && $this->authChecker->isGranted(TaskVoter::ACCESS, $task)) {
            $this->em->remove($task);
            $this->em->flush();

            return $task;
        }

        throw new Error(
            sprintf(
                'Task with id=%d not found!',
                $taskid
            )
        );
    }
}