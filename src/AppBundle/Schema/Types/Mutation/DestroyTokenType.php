<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 21.11.17
 * Time: 06:50
 */

namespace AppBundle\Schema\Types\Mutation;


use AppBundle\Entity\User;
use AppBundle\Schema\Types;
use Doctrine\ORM\EntityManager;
use GraphQL\Type\Definition\ObjectType;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

class DestroyTokenType extends ObjectType
{
    /** @var EntityManager */
    private $em;
    /** @var TokenStorageInterface */
    private $tokenStorage;

    public function __construct(RegistryInterface $doctrine, TokenStorageInterface $tokenStorage)
    {
        $this->em = $doctrine->getManager();
        $this->tokenStorage = $tokenStorage;

        $config = [
            'name' => 'DestroyToken',
            'fields' => [
                'success' => [
                    'type' => Types::boolean(),
                    'resolve' => function () {
                        return $this->resolveSuccess();
                    }
                ]
            ]
        ];
        parent::__construct($config);
    }

    private function resolveSuccess()
    {
        /** @var User $user */
        $user = $this->tokenStorage->getToken()->getUser();

        $apiToken = $user->getApiToken();
        $apiToken->setValidUntil(new \DateTime('-1 second'));

        $this->em->flush();

        return true;
    }
}