<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 23.11.17
 * Time: 17:28
 */

namespace AppBundle\Schema\Types\Mutation\Tasklist;


use AppBundle\Entity\Tasklist;
use AppBundle\Schema\Types;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

class CreateTasklistType extends ObjectType
{
    const TYPE_TASKLIST_NAME = 'name';

    /** @var EntityManager */
    private $em;
    /** @var  TokenInterface */
    private $tokenInterface;

    public function __construct(Registry $doctrine, TokenStorage $tokenStorage)
    {
        $this->em = $doctrine->getManager();
        $this->tokenInterface = $tokenStorage->getToken();

        $config = [
            'name' => 'CreateTasklist',
            'fields' => [
                'tasklist' => [
                    'type' => Types::tasklist(),
                    'args' => [
                        self::TYPE_TASKLIST_NAME => Types::nonNull(Types::string())
                    ],
                    'resolve' => function(Tasklist $tasklist, $args) {
                        return $this->createTasklist($tasklist, $args);
                    }
                ],
            ]
        ];
        parent::__construct($config);
    }

    private function createTasklist(Tasklist $tasklist, $args)
    {
        $name = $args[self::TYPE_TASKLIST_NAME];
        $user = $this->tokenInterface->getUser();

        $tasklist->setName($name)
            ->setOwner($user);

        $this->em->persist($tasklist);
        $this->em->flush();

        return $tasklist;
    }
}