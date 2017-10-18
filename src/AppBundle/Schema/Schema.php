<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 28.09.17
 * Time: 22:12
 */

namespace AppBundle\Schema;

use Doctrine\Bundle\DoctrineBundle\Registry;
use GraphQL\Type\Schema as GraphQLSchema;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class Schema extends GraphQLSchema
{
    public function __construct(AuthorizationCheckerInterface $authChecker, Registry $doctrine, TokenStorage $tokenStorage)
    {
        Types::clear();

        $config = [
            'query' => Types::query($authChecker, $doctrine, $tokenStorage),
            'mutation' => Types::mutation($doctrine, $tokenStorage)
        ];
        parent::__construct($config);
    }
}