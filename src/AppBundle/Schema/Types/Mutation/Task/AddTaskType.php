<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 23.11.17
 * Time: 07:24
 */

namespace AppBundle\Schema\Types\Mutation\Task;


use AppBundle\Entity\Task;
use AppBundle\Entity\Tasklist;
use AppBundle\Schema\Types;
use AppBundle\Security\TaskVoter;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class AddTaskType extends ObjectType
{
    const DESCRIPTION_FIELD_NAME = 'description';
    const DUEDATE_FIELD_NAME = 'duedate';
    const STARTDATE_FIELD_NAME = 'startdate';
    const TITLE_FIELD_NAME = 'title';
    const TYPE_FIELD_NAME = 'type';

    /** @var  AuthorizationCheckerInterface */
    private $authChecker;
    /** @var  EntityManager */
    private $em;

    public function __construct(AuthorizationCheckerInterface $authChecker, Registry $doctrine)
    {
        $this->authChecker = $authChecker;
        $this->em = $doctrine->getManager();

        $config = [
            'name' => 'AddTask',
            'fields' => [
                'task' => [
                    'type' => Types::task(),
                    'args' => [
                        self::TITLE_FIELD_NAME => Types::nonNull(Types::string()),
                        self::DESCRIPTION_FIELD_NAME => Types::string(),
                        self::TYPE_FIELD_NAME => Types::nonNull(Types::taskTypeEnum()),
                        self::STARTDATE_FIELD_NAME => Types::nonNull(Types::date()),
                        self::DUEDATE_FIELD_NAME => Types::date(),
                    ],
                    'resolve' => function($tasklist, $args) {
                        return $this->addTask($tasklist, $args);
                    }
                ]
            ]
        ];
        parent::__construct($config);
    }

    /**
     * @param Tasklist $tasklist
     * @param array $args
     */
    private function addTask($tasklist, $args) {
        $task = new Task();
        $task->setTasklist($tasklist);

        if ($this->authChecker->isGranted(TaskVoter::ACCESS, $task)) {
            $task->setTitle($args[self::TITLE_FIELD_NAME]);
            if (array_key_exists(self::DESCRIPTION_FIELD_NAME, $args)) {
                $task->setDescription($args[self::DESCRIPTION_FIELD_NAME]);
            }
            $task->setType($args[self::TYPE_FIELD_NAME]);
            $task->setStartDate($args[self::STARTDATE_FIELD_NAME]);
            if (array_key_exists(self::DUEDATE_FIELD_NAME, $args)) {
                $task->setDueDate($args[self::DUEDATE_FIELD_NAME]);
            }

            $this->em->persist($task);
            $this->em->flush();

            return $task;
        }

        throw new Error(
            'Authorization checker error occured'
        );
    }
}