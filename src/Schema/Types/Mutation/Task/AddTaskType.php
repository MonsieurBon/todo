<?php

namespace App\Schema\Types\Mutation\Task;

use App\Entity\Task;
use App\Entity\Tasklist;
use App\Schema\Schema;
use App\Schema\Types;
use Doctrine\ORM\EntityManager;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class AddTaskType extends ObjectType
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
            'name' => 'AddTask',
            'fields' => [
                'task' => [
                    'type' => Types::task(),
                    'args' => [
                        Schema::TITLE_FIELD_NAME => Types::nonNull(Types::string()),
                        Schema::DESCRIPTION_FIELD_NAME => Types::string(),
                        Schema::TYPE_FIELD_NAME => Types::nonNull(Types::taskTypeEnum()),
                        Schema::STARTDATE_FIELD_NAME => Types::nonNull(Types::date()),
                        Schema::DUEDATE_FIELD_NAME => Types::date(),
                    ],
                    'resolve' => function ($tasklist, $args) {
                        return $this->addTask($tasklist, $args);
                    }
                ]
            ]
        ];
        parent::__construct($config);
    }

    /**
     * @param Tasklist $tasklist
     * @param array    $args
     */
    private function addTask($tasklist, $args)
    {
        $task = new Task();
        $task->setTasklist($tasklist);

        $task->setTitle($args[Schema::TITLE_FIELD_NAME]);
        if (array_key_exists(Schema::DESCRIPTION_FIELD_NAME, $args)) {
            $task->setDescription($args[Schema::DESCRIPTION_FIELD_NAME]);
        }
        $task->setType($args[Schema::TYPE_FIELD_NAME]);
        $task->setStartDate($args[Schema::STARTDATE_FIELD_NAME]);
        if (array_key_exists(Schema::DUEDATE_FIELD_NAME, $args)) {
            $task->setDueDate($args[Schema::DUEDATE_FIELD_NAME]);
        }

        $this->em->persist($task);
        $this->em->flush();

        return $task;
    }
}
