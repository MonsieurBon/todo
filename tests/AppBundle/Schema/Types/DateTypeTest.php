<?php

namespace tests\AppBundle\Schema\Types;


use AppBundle\Schema\Types\DateType;
use GraphQL\Language\AST\IntValueNode;
use GraphQL\Language\AST\StringValueNode;
use PHPUnit\Framework\TestCase;

class DateTypeTest extends TestCase
{
    /** @var  string */
    private static $expectedDateString;
    /** @var  \DateTime */
    private static $date;
    /** @var  DateType */
    private static $dateType;

    public static function setUpBeforeClass()
    {
        static::$expectedDateString = '2017-10-25';
        $timeZone = new \DateTimeZone('UTC');
        static::$date = \DateTime::createFromFormat('!Y-m-d', static::$expectedDateString, $timeZone);
        static::$dateType = new DateType();
    }

    public function testSerialize()
    {
        $dateString = static::$dateType->serialize(static::$date);
        $this->assertEquals(static::$expectedDateString, $dateString);
    }

    public function testParseValue()
    {
        $date = static::$dateType->parseValue(static::$expectedDateString);

        $this->assertEquals(static::$date, $date);
    }

    /**
     * @expectedException \UnexpectedValueException
     * @expectedExceptionMessageRegExp /^Cannot represent value as date: "invalid date"$/
     */
    public function testParseInvalidValue()
    {
        static::$dateType->parseValue('invalid date');
    }

    public function testParseLiteralStringValueNode()
    {
        $stringValueNode = new StringValueNode(array());
        $stringValueNode->value = static::$expectedDateString;

        $date = static::$dateType->parseLiteral($stringValueNode);

        $this->assertEquals(static::$date, $date);
    }

    /**
     * @expectedException \GraphQL\Error\Error
     * @expectedExceptionMessageRegExp /^Query error: Can only parse strings got: IntValue$/
     */
    public function testParseLiteralOtherNode()
    {
        $intValueNode = new IntValueNode(array());
        $intValueNode->value = static::$expectedDateString;

        static::$dateType->parseLiteral($intValueNode);
    }
}