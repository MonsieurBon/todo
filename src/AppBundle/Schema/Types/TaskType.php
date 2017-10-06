<?php

namespace AppBundle\Schema\Types;

use AppBundle\Entity\Task;
use AppBundle\Schema\Types;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;

class TaskType extends ObjectType
{
    public function __construct()
    {
        $config = [
            'name' => 'Task',
            'fields' => function () {
                return [
                    'id' => Types::id(),
                    'title' => Types::string(),
                    'description' => Types::string(),
                    'startDate' => Types::date(),
                    'dueDate' => Types::date(),
                    'type' => Types::taskTypeEnum(),
                    'tasklist' => Types::tasklist(),
                ];
            },
            'resolveField' => function($value, $args, $context, ResolveInfo $info) {
                $method = 'resolve' . ucfirst($info->fieldName);
                if (method_exists($this, $method)) {
                    return $this->{$method}($value, $args, $context, $info);
                } else {
                    $getter = 'get' . ucfirst($info->fieldName);
                    return $value->{$getter}();
                }
            }
        ];
        parent::__construct($config);
    }

    private function resolveTasklist(Task $value) {
        return $value->getTasklist();
    }
}