<?php

namespace App\Schema\Types;

use App\Entity\TaskState;
use GraphQL\Type\Definition\EnumType;

class TaskStateEnum extends EnumType
{
    public function __construct()
    {
        $config = [
            'name' => 'TaskStateEnum',
            'values' => TaskState::values()
        ];
        parent::__construct($config);
    }
}
