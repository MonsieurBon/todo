<?php

namespace App\Schema\Types\Mutation\Task;

use App\Entity\Task;
use App\Schema\Schema;
use App\Schema\Types;
use App\Security\TaskVoter;
use Doctrine\ORM\EntityManager;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class EditTaskType extends ObjectType
{
    /** @var AuthorizationCheckerInterface */
    private $authChecker;
    /** @var EntityManager */
    private $em;

    public function __construct(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine)
    {
        $this->authChecker = $authChecker;
        $this->em = $doctrine->getManager();

        $config = [
            'name' => 'EditTask',
            'fields' => [
                'task' => [
                    'type' => Types::task(),
                    'args' => [
                        Schema::TASK_ID_FIELD_NAME => Types::nonNull(Types::int()),
                        Schema::TITLE_FIELD_NAME => Types::nonNull(Types::string()),
                        Schema::DESCRIPTION_FIELD_NAME => Types::string(),
                        Schema::TYPE_FIELD_NAME => Types::nonNull(Types::taskTypeEnum()),
                        Schema::STATE_FIELD_NAME => Types::nonNull(Types::taskStateEnum()),
                        Schema::STARTDATE_FIELD_NAME => Types::nonNull(Types::date()),
                        Schema::DUEDATE_FIELD_NAME => Types::date(),
                    ],
                    'resolve' => function ($val, $args) {
                        return $this->editTask($args);
                    }
                ]
            ]
        ];
        parent::__construct($config);
    }

    /**
     * @param array $args
     */
    private function editTask($args)
    {
        $taskid = $args[Schema::TASK_ID_FIELD_NAME];
        $task = $this->em->getRepository(Task::class)->find($taskid);

        if ($task !== null && $this->authChecker->isGranted(TaskVoter::ACCESS, $task)) {
            $task->setTitle($args[Schema::TITLE_FIELD_NAME]);
            if (array_key_exists(Schema::DESCRIPTION_FIELD_NAME, $args)) {
                $task->setDescription($args[Schema::DESCRIPTION_FIELD_NAME]);
            }
            $task->setType($args[Schema::TYPE_FIELD_NAME]);
            $task->setState($args[Schema::STATE_FIELD_NAME]);
            $task->setStartDate($args[Schema::STARTDATE_FIELD_NAME]);
            if (array_key_exists(Schema::DUEDATE_FIELD_NAME, $args)) {
                $task->setDueDate($args[Schema::DUEDATE_FIELD_NAME]);
            }

            $this->em->flush();
        }

        return $task;
    }
}
