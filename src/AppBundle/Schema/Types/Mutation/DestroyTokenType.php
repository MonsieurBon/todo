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
use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\ORM\EntityManager;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;

class DestroyTokenType extends ObjectType
{
    /** @var EntityManager */
    private $em;
    /** @var TokenStorage */
    private $tokenStorage;

    public function __construct(Registry $doctrine, TokenStorage $tokenStorage)
    {
        $this->em = $doctrine->getManager();
        $this->tokenStorage = $tokenStorage;

        $config = [
            'name' => 'DestroyToken',
            'fields' => [
                'success' => Types::boolean()
            ],
            'resolveField' => function($val, $args, $context, ResolveInfo $info)
            {
                $method = 'resolve' . ucfirst($info->fieldName);
                return $this->{$method}($val, $args, $context, $info);
            }
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