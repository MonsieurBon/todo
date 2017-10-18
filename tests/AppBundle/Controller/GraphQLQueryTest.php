<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 05.10.17
 * Time: 06:39
 */

namespace Tests\AppBundle\Controller;


use AppBundle\Entity\TaskType;
use Tests\AppBundle\DB\Fixtures\ValidToken;

class GraphQLQueryTest extends GraphQLTestCase
{
    protected function setUp()
    {
        $this->initialize(array(
            'Tests\AppBundle\DB\Fixtures\ValidToken'
        ));
    }

    public function testEmptyQueryShouldReturnHello()
    {
        $query = '';
        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();

        self::assertEquals(200, $response->getStatusCode());
        self::assertEquals(
            '{"data":{"hello":"Your GraphQL endpoint is ready! Use GraphiQL to browse API."}}',
            $response->getContent()
        );
    }

    public function testAllTasklistQuery()
    {
        $query = '{"query":"query {\n  tasklists {\n    id\n    name\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        self::assertEquals(200, $response->getStatusCode());
        self::assertCount(3, $json->data->tasklists);
        foreach($json->data->tasklists as $tasklist) {
            self::assertContains($tasklist->name, array('Home', 'Office', 'Shared'));
        }
    }

    public function testQuerySpecificTasklist()
    {
        $tasklistId = $this->fixtures->getReference('tasklist1')->getId();
        $query = '{"query":"query {\n  tasklist(id: ' . $tasklistId . ') {\n    name\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        self::assertEquals(200, $response->getStatusCode());
        self::assertEquals('Home', $json->data->tasklist->name);
    }

    public function testQueryTasklistsWithTasks()
    {
        $tasklistId = $this->fixtures->getReference('tasklist1')->getId();
        $query = '{"query":"query {\n tasklist(id: ' . $tasklistId . ') {\n name\n tasks {\n title\n description\n type\n startDate}\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        self::assertEquals(200, $response->getStatusCode());
        self::assertEquals('Home', $json->data->tasklist->name);
        self::assertCount(3, $json->data->tasklist->tasks);
        self::assertEquals('2017-10-20', $json->data->tasklist->tasks[0]->startDate);
    }

    public function testQueryTasklistWithNoAccess()
    {
        $tasklistId = $this->fixtures->getReference('tasklist3')->getId();
        $query = '{"query":"query {\n tasklist(id: ' . $tasklistId . ') {\n name\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        self::assertEquals(200, $response->getStatusCode());
        self::assertCount(1, $json->errors);
        self::assertEquals('No tasklist with id=' . $tasklistId . ' found', $json->errors[0]->message);
    }

    public function testInvalidQueryFails()
    {
        $query = '{"query":"query {\n  foobar {\n    foo\n    bar\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        self::assertEquals(200, $response->getStatusCode());
        self::assertCount(1, $json->errors);
        self::assertEquals('Cannot query field "foobar" on type "Query".', $json->errors[0]->message);
    }

    public function testValidateSchema()
    {
        $query = '';
        $parameters = array(
            'debug_api' => '1'
        );
        $client = static::sendApiQuery($query, ValidToken::TOKEN, $parameters);
        $response = $client->getResponse();

        self::assertEquals(200, $response->getStatusCode());
    }

    public function testAddTask()
    {
        $tasklistId = $this->fixtures->getReference('tasklist1')->getId();
        $query = '{"query":"mutation {\n addTask(\n title: \"My Title\"\n description: \"My description\"\n type: OPPORTUNITY_NOW\n startdate: \"2017-12-15\"\n duedate: \"2018-01-15\"\n tasklist: ' . $tasklistId . '\n ) {\n id\n title\n description\n type\n startDate\n dueDate\n tasklist {\n id\n }\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);
        $task = $json->data->addTask;

        self::assertEquals(200, $response->getStatusCode());
        self::assertNotNull($task);
        self::assertNotNull($task->id);
        self::assertEquals('My Title', $task->title);
        self::assertEquals('My description', $task->description);
        self::assertEquals(TaskType::OPPORTUNITY_NOW, $task->type);
        self::assertEquals('2017-12-15', $task->startDate);
        self::assertEquals('2018-01-15', $task->dueDate);
        self::assertEquals($tasklistId, $task->tasklist->id);
    }

    public function testAddTaskToInvalidTasklist()
    {
        $query = '{"query":"mutation {\n addTask(\n title: \"My Title\"\n description: \"My description\"\n type: OPPORTUNITY_NOW\n startdate: \"2017-12-15\"\n duedate: \"2018-01-15\"\n tasklist: -1\n ) {\n id\n title\n description\n type\n startDate\n dueDate\n tasklist {\n id\n }\n }\n}","variables": null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $json = json_decode($response->getContent());

        self::assertEquals(200, $response->getStatusCode());
        self::assertContains("Tasklist with id -1 not found!", $json->errors[0]->message);
    }
}