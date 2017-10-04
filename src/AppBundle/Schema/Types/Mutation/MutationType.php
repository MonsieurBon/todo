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
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;

class MutationType extends ObjectType
{
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
                        'title' => Types::nonNull(Types::string()),
                        'description' => Types::string(),
                        'type' => Types::nonNull(Types::taskTypeEnum()),
                        'startdate' => Types::nonNull(Types::date()),
                        'duedate' => Types::date(),
                        'tasklist' => Types::nonNull(Types::id())
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

    private function addTask($args)
    {
        $tasklistid = $args['tasklist'];
        $tasklist = $this->doctrine->getRepository(TaskList::class)->find($tasklistid);

        if (!$tasklist) {
            throw new \Exception('Tasklist with id ' . $tasklistid . ' not found!');
        }

        $task = new Task();
        $task->setTitle($args['title']);
        if (array_key_exists('description', $args)) {
            $task->setDescription($args['description']);
        }
        $task->setType($args['type']);
        $task->setStartDate($args['startdate']);
        if (array_key_exists('duedate', $args)) {
            $task->setDueDate($args['duedate']);
        }
        $task->setTasklist($tasklist);

        $em = $this->doctrine->getManager();
        $em->persist($task);
        $em->flush();

        return $task;
    }
}