<?php

namespace App\Schema\Types\Mutation\Tasklist;

use App\Entity\Tasklist;
use App\Schema\Schema;
use App\Schema\Types;
use App\Security\TasklistVoter;
use Doctrine\ORM\EntityManager;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class EditTasklistType extends ObjectType
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
            'name' => 'EditTasklist',
            'fields' => [
                'tasklist' => [
                    'type' => Types::tasklist(),
                    'args' => [
                        Schema::TASKLIST_ID_FIELD_NAME => Types::nonNull(Types::int()),
                        Schema::TASKLIST_NAME_FIELD_NAME => Types::nonNull(Types::string())
                    ],
                    'resolve' => function ($val, $args) {
                        return $this->editTasklist($args);
                    }
                ],
            ]
        ];
        parent::__construct($config);
    }

    /**
     * @param $args
     *
     * @return Tasklist
     *
     * @throws Error
     */
    private function editTasklist($args)
    {
        $tasklistid = $args[Schema::TASKLIST_ID_FIELD_NAME];
        $name = $args[Schema::TASKLIST_NAME_FIELD_NAME];

        /** @var Tasklist $tasklist */
        $tasklist = $this->em->getRepository(Tasklist::class)->find($tasklistid);

        if ($tasklist === null) {
            throw new Error(
                sprintf(
                    'Tasklist with id=%d not found!',
                    $tasklistid
                )
            );
        }

        if ($this->authChecker->isGranted(TasklistVoter::OWNER, $tasklist)) {
            $tasklist->setName($name);
            $this->em->flush();
        } else {
            throw new Error('Only the owner of a tasklist may change its name.');
        }

        return $tasklist;
    }
}
