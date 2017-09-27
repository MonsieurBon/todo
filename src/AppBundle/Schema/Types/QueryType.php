<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 26.09.17
 * Time: 09:48
 */

namespace AppBundle\Schema\Types;


use AppBundle\Entity\Tasklist;
use AppBundle\Schema\Types;
use Doctrine\Bundle\DoctrineBundle\Registry;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;

class QueryType extends ObjectType
{
    private $doctrine;

    public function __construct(Registry $doctrine)
    {
        $this->doctrine = $doctrine;

        $config = [
            'name' => 'Query',
            'fields' => [
                'hello' => Types::string(),
                'tasklists' => [
                    'type' => Types::listOf(Types::tasklist()),
                    'description' => 'Returns all tasklists'
                ],
                'tasklist' => [
                    'type' => Types::tasklist(),
                    'description' => 'Returns tasklist by id',
                    'args' => [
                            'id' => Types::nonNull(Types::id())
                    ]
                ]
            ],
            'resolveField' => function ($val, $args, $context, ResolveInfo $info)
            {
                return $this->{$info->fieldName}($val, $args, $context, $info);
            }
        ];
        parent::__construct($config);
    }

    private function hello()
    {
        return "Your GraphQL endpoint is ready! Use GraphiQL to browse API.";
    }

    private function tasklists()
    {
        return $this->doctrine->getRepository(Tasklist::class)->findAll();
    }

    private function tasklist($val, $args)
    {
        return $this->doctrine->getRepository(Tasklist::class)->find($args['id']);
    }
}