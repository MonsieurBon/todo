<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 05.10.17
 * Time: 06:39
 */

namespace Tests\AppBundle\Controller;


use AppBundle\Entity\TaskType;

class GraphQLQueryTest extends GraphQLTestCase
{
    /** @var  string */
    private static $token;

    public static function setUpBeforeClass()
    {
        $query = '{"query":"mutation{\n  createToken(username: \"foo\", password: \"test\"){\n    error\n    token\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query);
        $content = $client->getResponse()->getContent();
        $json = json_decode($content);

        static::$token = $json->data->createToken->token;
    }

    public function testEmptyQueryShouldReturnHello()
    {
        $query = '';
        $client = static::sendApiQuery($query, static::$token);
        $response = $client->getResponse();

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals(
            '{"data":{"hello":"Your GraphQL endpoint is ready! Use GraphiQL to browse API."}}',
            $response->getContent()
        );
    }

    public function testAllTasklistQuery()
    {
        $query = '{"query":"query {\n  tasklists {\n    id\n    name\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query, static::$token);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertCount(3, $json->data->tasklists);
        foreach($json->data->tasklists as $tasklist) {
            $this->assertContains($tasklist->name, array('Home', 'Office', 'Shared'));
        }
    }

    public function testQuerySpecifictTasklist()
    {
        $query = '{"query":"query {\n  tasklist(id: 1) {\n    name\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query, static::$token);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals('Home', $json->data->tasklist->name);
    }

    public function testQueryTasklistsWithTasks()
    {
        $query = '{"query":"query {\n tasklist(id: 1) {\n name\n tasks {\n title\n description\n type\n startDate}\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, static::$token);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals('Home', $json->data->tasklist->name);
        $this->assertCount(3, $json->data->tasklist->tasks);
        $this->assertEquals('2017-10-20', $json->data->tasklist->tasks[0]->startDate);
    }

    public function testQueryTasklistWithNoAccess()
    {
        $query = '{"query":"query {\n tasklist(id: 3) {\n name\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, static::$token);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertCount(1, $json->errors);
        $this->assertEquals('No tasklist with id=3 found', $json->errors[0]->message);
    }

    public function testInvalidQueryFails()
    {
        $query = '{"query":"query {\n  foobar {\n    foo\n    bar\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query, static::$token);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertCount(1, $json->errors);
        $this->assertEquals('Cannot query field "foobar" on type "Query".', $json->errors[0]->message);
    }

    public function testValidateSchema()
    {
        $query = '';
        $parameters = array(
            'debug_api' => '1'
        );
        $client = static::sendApiQuery($query, static::$token, $parameters);
        $response = $client->getResponse();

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function testAddTask()
    {
        $query = '{"query":"mutation {\n addTask(\n title: \"My Title\"\n description: \"My description\"\n type: OPPORTUNITY_NOW\n startdate: \"2017-12-15\"\n duedate: \"2018-01-15\"\n tasklist: 1\n ) {\n id\n title\n description\n type\n startDate\n dueDate\n tasklist {\n id\n }\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, static::$token);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);
        $task = $json->data->addTask;

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertNotNull($task);
        $this->assertNotNull($task->id);
        $this->assertEquals('My Title', $task->title);
        $this->assertEquals('My description', $task->description);
        $this->assertEquals(TaskType::OPPORTUNITY_NOW, $task->type);
        $this->assertEquals('2017-12-15', $task->startDate);
        $this->assertEquals('2018-01-15', $task->dueDate);
        $this->assertEquals(1, $task->tasklist->id);
    }

    public function testAddTaskToInvalidTasklist()
    {
        $query = '{"query":"mutation {\n addTask(\n title: \"My Title\"\n description: \"My description\"\n type: OPPORTUNITY_NOW\n startdate: \"2017-12-15\"\n duedate: \"2018-01-15\"\n tasklist: -1\n ) {\n id\n title\n description\n type\n startDate\n dueDate\n tasklist {\n id\n }\n }\n}","variables": null}';

        $client = static::sendApiQuery($query, static::$token);
        $response = $client->getResponse();
        $json = json_decode($response->getContent());

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertContains("Tasklist with id -1 not found!", $json->errors[0]->message);
    }
}