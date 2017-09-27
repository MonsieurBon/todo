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
                    return $value->{$info->fieldName};
                }
            }
        ];
        parent::__construct($config);
    }

    private function resolveId(Task $value)
    {
        return $value->getId();
    }

    private function resolveTitle(Task $value)
    {
        return $value->getTitle();
    }

    private function resolveDescription(Task $value)
    {
        return $value->getDescription();
    }

    private function resolveStartDate(Task $value)
    {
        return $value->getStartDate();
    }

    private function resolveDueDate(Task $value) {
        return $value->getDueDate();
    }

    private function resolveType(Task $value) {
        return $value->getType();
    }

    private function resolveTasklist(Task $value) {
        return $value->getTasklist();
    }
}