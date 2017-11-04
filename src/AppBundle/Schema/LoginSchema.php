<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 02.10.17
 * Time: 06:47
 */

namespace AppBundle\Schema;


use AppBundle\Entity\ApiToken;
use AppBundle\Repository\ApiTokenRepository;
use Doctrine\Bundle\DoctrineBundle\Registry;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Schema;
use Symfony\Component\DependencyInjection\ContainerInterface;

class LoginSchema extends Schema
{
    /** @var ApiTokenRepository */
    private $tokenRepo;

    public function __construct(ContainerInterface $container)
    {
        Types::clear();

        $this->tokenRepo = $container->get('doctrine')->getRepository(ApiToken::class);

        $config = [
            'query' => new ObjectType([
                'name' => 'Query',
                'fields' => [
                    'hello' => [
                        'type' => Types::string(),
                        'resolve' => function() {
                            return "Your GraphQL endpoint is ready! Please log in to see the full API.";
                        }
                    ],
                    'checkToken' => [
                        'type' => Types::tokenValidity(),
                        'args' => [
                            'token' => Types::nonNull(Types::string())
                        ],
                        'resolve' => function($val, $args) {
                            return $this->checkToken($val, $args);
                        }
                    ]
                ]
            ]),
            'mutation' => Types::login($container)
        ];
        parent::__construct($config);
    }

    private function checkToken($val, $args) {
        $token = $args['token'];

        $apiToken = $this->tokenRepo->findValidToken($token);

        if ($apiToken !== null) {
            return $token;
        }

        throw new Error('Token is invalid');
    }
}