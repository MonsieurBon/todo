<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 02.10.17
 * Time: 06:47
 */

namespace AppBundle\Schema;


use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Schema;
use Symfony\Component\DependencyInjection\ContainerInterface;

class LoginSchema extends Schema
{
    public function __construct(ContainerInterface $container)
    {
        $config = [
            'query' => new ObjectType([
                'name' => 'Query',
                'fields' => [
                    'hello' => [
                        'type' => Types::string(),
                        'resolve' => function() {
                            return "Your GraphQL endpoint is ready! Please log in to see the full API.";
                        }
                    ]
                ]
            ]),
            'mutation' => Types::login($container)
        ];
        parent::__construct($config);
    }
}