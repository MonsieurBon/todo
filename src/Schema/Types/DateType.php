<?php

namespace App\Schema\Types;

use GraphQL\Error\Error;
use GraphQL\Language\AST\Node;
use GraphQL\Language\AST\StringValueNode;
use GraphQL\Type\Definition\ScalarType;
use GraphQL\Utils\Utils;

class DateType extends ScalarType
{
    const PRINT_FORMAT = 'Y-m-d';
    const PARSE_FORMAT = '!' . self::PRINT_FORMAT;

    /**
     * Serializes an internal value to include in a response.
     *
     * @param mixed $value
     *
     * @return mixed
     */
    public function serialize($value)
    {
        return $value->format(self::PRINT_FORMAT);
    }

    /**
     * Parses an externally provided value (query variable) to use as an input
     *
     * @param mixed $value
     *
     * @return mixed
     */
    public function parseValue($value)
    {
        $timeZone = new \DateTimeZone('UTC');
        $date = \DateTime::createFromFormat(self::PARSE_FORMAT, $value, $timeZone);

        if ($date === false) {
            throw new \UnexpectedValueException('Cannot represent value as date: ' . Utils::printSafe($value));
        }

        return $date;
    }

    /**
     * Parses an externally provided literal value (hardcoded in GraphQL query) to use as an input
     *
     * In the case of an invalid node or value this method must throw an Exception
     *
     * @param Node       $valueNode
     * @param array|null $variables
     *
     * @return mixed
     *
     * @throws \Exception
     */
    public function parseLiteral($valueNode, array $variables = null)
    {
        if (!$valueNode instanceof StringValueNode) {
            throw new Error('Query error: Can only parse strings got: ' . $valueNode->kind, [$valueNode]);
        }

        return $this->parseValue($valueNode->value);
    }
}
