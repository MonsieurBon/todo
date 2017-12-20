<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 23.11.17
 * Time: 17:28
 */

namespace App\Schema\Types\Mutation\Tasklist;


use App\Entity\Tasklist;
use App\Schema\Schema;
use App\Schema\Types;
use Doctrine\ORM\EntityManager;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

class CreateTasklistType extends ObjectType
{
    /** @var EntityManager */
    private $em;
    /** @var  TokenInterface */
    private $tokenInterface;

    public function __construct(RegistryInterface $doctrine, TokenStorageInterface $tokenStorage)
    {
        $this->em = $doctrine->getManager();
        $this->tokenInterface = $tokenStorage->getToken();

        $config = [
            'name' => 'CreateTasklist',
            'fields' => [
                'tasklist' => [
                    'type' => Types::tasklist(),
                    'args' => [
                        Schema::TASKLIST_NAME_FIELD_NAME => Types::nonNull(Types::string())
                    ],
                    'resolve' => function($val, $args) {
                        return $this->createTasklist($args);
                    }
                ],
            ]
        ];
        parent::__construct($config);
    }

    private function createTasklist($args)
    {
        $name = $args[Schema::TASKLIST_NAME_FIELD_NAME];
        $user = $this->tokenInterface->getUser();

        $tasklist = (new Tasklist())
            ->setName($name)
            ->setOwner($user);

        $this->em->persist($tasklist);
        $this->em->flush();

        return $tasklist;
    }
}