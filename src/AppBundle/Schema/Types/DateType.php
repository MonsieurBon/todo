<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 26.09.17
 * Time: 01:09
 */

namespace AppBundle\Schema\Types;


use GraphQL\Error\Error;
use GraphQL\Language\AST\StringValueNode;
use GraphQL\Type\Definition\ScalarType;
use GraphQL\Utils\Utils;

class DateType extends ScalarType
{
    const PRINT_FORMAT = 'Y-m-d';
    const PARSE_FORMAT = '!' . DateType::PRINT_FORMAT;

    /**
     * Serializes an internal value to include in a response.
     *
     * @param mixed $value
     * @return mixed
     */
    public function serialize($value)
    {
        return $value->format(DateType::PRINT_FORMAT);
    }

    /**
     * Parses an externally provided value (query variable) to use as an input
     *
     * @param mixed $value
     * @return mixed
     */
    public function parseValue($value)
    {
        $timeZone = new \DateTimeZone('UTC');
        $date = \DateTime::createFromFormat(DateType::PARSE_FORMAT, $value, $timeZone);

        if ($date === false) {
            throw new \UnexpectedValueException("Cannot represent value as date: " . Utils::printSafe($value));
        }

        return $date;
    }

    /**
     * Parses an externally provided literal value (hardcoded in GraphQL query) to use as an input
     *
     * @param \GraphQL\Language\AST\Node $valueNode
     * @return mixed
     * @throws Error
     */
    public function parseLiteral($valueNode)
    {
        if (!$valueNode instanceof StringValueNode) {
            throw new Error("Query error: Can only parse strings got: " . $valueNode->kind, [$valueNode]);
        }

        return $this->parseValue($valueNode->value);
    }
}