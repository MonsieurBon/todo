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
use Doctrine\Bundle\DoctrineBundle\Registry;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;

class MutationType extends ObjectType
{
    const TITLE_FIELD_NAME = 'title';
    const DESCRIPTION_FIELD_NAME = 'description';
    const TYPE_FIELD_NAME = 'type';
    const STARTDATE_FIELD_NAME = 'startdate';
    const DUEDATE_FIELD_NAME = 'duedate';
    const TASKLIST_FIELD_NAME = 'tasklist';

    /**
     * @var Registry
     */
    private $doctrine;

    public function __construct(Registry $doctrine)
    {
        $this->doctrine = $doctrine;

        $config = [
            'name' => 'Mutation',
            'fields' => [
                'addTask' => [
                    'type' => Types::task(),
                    'description' => 'adds a Task',
                    'args' => [
                        MutationType::TITLE_FIELD_NAME => Types::nonNull(Types::string()),
                        MutationType::DESCRIPTION_FIELD_NAME => Types::string(),
                        MutationType::TYPE_FIELD_NAME => Types::nonNull(Types::taskTypeEnum()),
                        MutationType::STARTDATE_FIELD_NAME => Types::nonNull(Types::date()),
                        MutationType::DUEDATE_FIELD_NAME => Types::date(),
                        MutationType::TASKLIST_FIELD_NAME => Types::nonNull(Types::id())
                    ]
                ]
            ],
            'resolveField' => function ($val, $args, $context, ResolveInfo $info)
            {
                return $this->{$info->fieldName}($args);
            }
        ];
        parent::__construct($config);
    }

    /** @noinspection PhpUnusedPrivateMethodInspection */
    private function addTask($args)
    {
        $tasklistid = $args[MutationType::TASKLIST_FIELD_NAME];
        $tasklist = $this->doctrine->getRepository(TaskList::class)->find($tasklistid);

        if (!$tasklist) {
            throw new Error('Tasklist with id ' . $tasklistid . ' not found!');
        }

        $task = new Task();
        $task->setTitle($args[MutationType::TITLE_FIELD_NAME]);
        if (array_key_exists(MutationType::DESCRIPTION_FIELD_NAME, $args)) {
            $task->setDescription($args[MutationType::DESCRIPTION_FIELD_NAME]);
        }
        $task->setType($args[MutationType::TYPE_FIELD_NAME]);
        $task->setStartDate($args[MutationType::STARTDATE_FIELD_NAME]);
        if (array_key_exists(MutationType::DUEDATE_FIELD_NAME, $args)) {
            $task->setDueDate($args[MutationType::DUEDATE_FIELD_NAME]);
        }
        $task->setTasklist($tasklist);

        $em = $this->doctrine->getManager();
        $em->persist($task);
        $em->flush();

        return $task;
    }
}