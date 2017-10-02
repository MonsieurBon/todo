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

class Schema extends GraphQLSchema
{
    public function __construct(Registry $doctrine)
    {
        $config = [
            'query' => Types::query($doctrine),
            'mutation' => Types::mutation($doctrine)
        ];
        parent::__construct($config);
    }
}