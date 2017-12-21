<?php

namespace App\Schema\Types\Query;

use App\Schema\Types;
use GraphQL\Type\Definition\ObjectType;

class TokenValidityType extends ObjectType
{
    public function __construct()
    {
        $config = [
            'name' => 'TokenValidity',
            'fields' => [
                'token' => Types::string()
            ],
            'resolveField' => function ($val) {
                return $val;
            }
        ];
        parent::__construct($config);
    }
}
