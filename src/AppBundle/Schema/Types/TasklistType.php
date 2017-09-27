<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 26.09.17
 * Time: 02:06
 */

namespace AppBundle\Schema\Types;


use AppBundle\Entity\Tasklist;
use AppBundle\Schema\Types;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;

class TasklistType extends ObjectType
{
    public function __construct()
    {
        $config = [
            'name' => 'Tasklist',
            'fields' => function() {
                return [
                    'id' => Types::id(),
                    'name' => Types::string(),
                    'tasks' => Types::listOf(Types::task())
                ];
            },
            'resolveField' => function($value, $args, $context, ResolveInfo $info) {
                $method = 'resolve' . ucfirst($info->fieldName);
                if (method_exists($this, $method)) {
                    return $this->{$method}($value, $args, $context, $info);
                } else {
                    return $value->{$info->fieldName};
                }
            }
        ];
        parent::__construct($config);
    }

    private function resolveId(Tasklist $value)
    {
        return $value->getId();
    }

    private function resolveName(Tasklist $value)
    {
        return $value->getName();
    }

    private function resolveTasks(Tasklist $value)
    {
        return $value->getTasks();
    }
}