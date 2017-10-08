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
                        self::TITLE_FIELD_NAME => Types::nonNull(Types::string()),
                        self::DESCRIPTION_FIELD_NAME => Types::string(),
                        self::TYPE_FIELD_NAME => Types::nonNull(Types::taskTypeEnum()),
                        self::STARTDATE_FIELD_NAME => Types::nonNull(Types::date()),
                        self::DUEDATE_FIELD_NAME => Types::date(),
                        self::TASKLIST_FIELD_NAME => Types::nonNull(Types::id())
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
        $tasklistid = $args[self::TASKLIST_FIELD_NAME];
        $tasklist = $this->doctrine->getRepository(TaskList::class)->find($tasklistid);

        if (!$tasklist) {
            throw new Error('Tasklist with id ' . $tasklistid . ' not found!');
        }

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

        $em = $this->doctrine->getManager();
        $em->persist($task);
        $em->flush();

        return $task;
    }
}