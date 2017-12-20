<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 04.11.17
 * Time: 13:42
 */

namespace App\Schema\Types\Query;


use App\Schema\Types;
use GraphQL\Type\Definition\ObjectType;
use function React\Promise\resolve;

class TokenValidityType extends ObjectType
{
    public function __construct()
    {
        $config = [
            'name' => 'TokenValidity',
            'fields' => [
                'token' => Types::string()
            ],
            'resolveField' => function($val) {
                return $val;
            }
        ];
        parent::__construct($config);
    }
}