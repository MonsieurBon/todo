<?php

namespace AppBundle\Schema\Types;


use AppBundle\Entity\TaskType as EntityTaskType;
use GraphQL\Type\Definition\EnumType;

class TaskTypeEnum extends EnumType
{
    public function __construct()
    {
        $config = [
            'name' => 'TaskTypeEnum',
            'values' => EntityTaskType::values()
        ];
        parent::__construct($config);
    }
}