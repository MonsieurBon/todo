<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 28.11.17
 * Time: 16:54
 */

namespace AppBundle\Schema\Types\Mutation\Tasklist;


use AppBundle\Entity\Tasklist;
use AppBundle\Entity\User;
use AppBundle\Schema\Schema;
use AppBundle\Schema\Types;
use AppBundle\Security\TasklistVoter;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class ShareTasklistType extends ObjectType
{
    /** @var  AuthorizationCheckerInterface */
    private $authChecker;
    /** @var  EntityManager */
    private $em;

    public function __construct(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine)
    {
        $this->authChecker = $authChecker;
        $this->em = $doctrine->getManager();

        $config = [
            'name' => 'ShareTasklist',
            'fields' => [
                'tasklist' => [
                    'type' => Types::tasklist(),
                    'args' => [
                        Schema::TASKLIST_ID_FIELD_NAME => Types::nonNull(Types::id()),
                        Schema::USER_ID_FIELD_NAME => Types::nonNull(Types::id())
                    ],
                    'resolve' => function($vals, $args) {
                        return $this->shareTasklist($args);
                    }
                ]
            ]
        ];
        parent::__construct($config);
    }

    private function shareTasklist($args) {
        $tasklistid = $args[Schema::TASKLIST_ID_FIELD_NAME];
        $userid = $args[Schema::USER_ID_FIELD_NAME];

        /** @var Tasklist $tasklist */
        $tasklist = $this->em->getRepository(Tasklist::class)->find($tasklistid);
        /** @var User $user */
        $user = $this->em->getRepository(User::class)->find($userid);

        if ($tasklist === null) {
            throw new Error(
                sprintf(
                    'Tasklist with id=%d not found!',
                    $tasklistid
                )
            );
        }

        if ($user === null) {
            throw new Error(
                sprintf(
                    'User with id=%d not found!',
                    $userid
                )
            );
        }

        if ($this->authChecker->isGranted(TasklistVoter::OWNER, $tasklist)) {
            $tasklist->addUser($user);
            $this->em->flush();
        } else {
            throw new Error('Only the owner of a tasklist may share it with other users.');
        }

        return $tasklist;
    }
}