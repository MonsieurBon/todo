<?php

namespace App\Tests\Controller;

use App\Entity\Task;
use App\Entity\TaskType;
use Doctrine\ORM\EntityManager;
use App\Tests\DB\Fixtures\ValidToken;

class GraphQLQueryTest extends GraphQLTestCase
{
    protected function setUp()
    {
        $this->initialize([
            'App\Tests\DB\Fixtures\ValidToken'
        ]);
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
        foreach ($json->data->tasklists as $tasklist) {
            self::assertContains($tasklist->name, ['Home', 'Office', 'Shared']);
        }
    }

    public function testQuerySpecificTasklist()
    {
        $tasklistSlug = $this->fixtures->getReference('tasklist1')->getSlug();
        $query = '{"query":"query {\n  tasklist(slug: \"' . $tasklistSlug . '\") {\n    name\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        self::assertEquals(200, $response->getStatusCode());
        self::assertEquals('Home', $json->data->tasklist->name);
    }

    public function testQueryTasklistsWithTasks()
    {
        $tasklistSlug = $this->fixtures->getReference('tasklist1')->getSlug();
        $query = '{"query":"query {\n tasklist(slug: \"' . $tasklistSlug . '\") {\n name\n tasks {\n title\n description\n type\n startdate}\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        self::assertEquals(200, $response->getStatusCode());
        self::assertEquals('Home', $json->data->tasklist->name);
        self::assertCount(2, $json->data->tasklist->tasks);
        self::assertEquals('2018-01-15', $json->data->tasklist->tasks[0]->startdate);
    }

    public function testQueryTasklistWithNoAccess()
    {
        $tasklistSlug = $this->fixtures->getReference('tasklist3')->getSlug();
        $query = '{"query":"query {\n tasklist(slug: \"' . $tasklistSlug . '\") {\n name\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        self::assertEquals(200, $response->getStatusCode());
        self::assertCount(1, $json->errors);
        self::assertEquals('No tasklist with slug=' . $tasklistSlug . ' found', $json->errors[0]->message);
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
        $parameters = [
            'debug_api' => '1'
        ];
        $client = static::sendApiQuery($query, ValidToken::TOKEN, $parameters);
        $response = $client->getResponse();

        self::assertEquals(200, $response->getStatusCode());
    }

    public function testAddTask()
    {
        $tasklistId = $this->fixtures->getReference('tasklist1')->getId();
        $query = '{"query":"mutation {\n addTask(\n tasklist_id: ' . $tasklistId . '\n ) {task(\n title: \"My Title\"\n description: \"My description\"\n type: OPPORTUNITY_NOW\n startdate: \"2017-12-15\"\n duedate: \"2018-01-15\"\n ){\n id\n title\n description\n type\n startdate\n duedate\n tasklist {\n id\n }\n }\n}\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);
        $task = $json->data->addTask->task;

        self::assertEquals(200, $response->getStatusCode());
        self::assertNotNull($task);
        self::assertNotNull($task->id);
        self::assertEquals('My Title', $task->title);
        self::assertEquals('My description', $task->description);
        self::assertEquals(TaskType::OPPORTUNITY_NOW, $task->type);
        self::assertEquals('2017-12-15', $task->startdate);
        self::assertEquals('2018-01-15', $task->duedate);
        self::assertEquals($tasklistId, $task->tasklist->id);
    }

    public function testAddTaskToInvalidTasklist()
    {
        $query = '{"query":"mutation {\n addTask(\n tasklist_id: -1\n ) {task(\n title: \"My Title\"\n description: \"My description\"\n type: OPPORTUNITY_NOW\n startdate: \"2017-12-15\"\n duedate: \"2018-01-15\"\n ){\n id\n title\n description\n type\n startdate\n duedate\n tasklist {\n id\n }\n }\n}\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $json = json_decode($response->getContent());

        self::assertEquals(200, $response->getStatusCode());
        self::assertContains('Tasklist with id=-1 not found!', $json->errors[0]->message);
    }

    public function testLoginInvalidatesExistingToken()
    {
        $query = '{"query":"mutation{\n  createToken(username: \"foo\", password: \"test\"){\n    error\n    token\n  }\n}","variables":null}';

        $client = static::sendApiQuery($query);
        $response = $client->getResponse();
        $json = json_decode($response->getContent());

        self::assertNotEquals(ValidToken::TOKEN, $json->data->createToken->token);

        /** @var EntityManager $em */
        $em = $this->getContainer()->get('doctrine')->getManager();

        $query = $em->createQuery(
            'SELECT t
            FROM App:ApiToken t
            WHERE t.token = SHA2(CONCAT_WS(\'\', t.salt, :token), 512)'
        )->setParameter('token', ValidToken::TOKEN);

        $result = $query->getResult();

        self::assertCount(0, $result);
    }

    public function testCheckTokenValid()
    {
        $query = '{"query":"{checkToken(token: \"' . ValidToken::TOKEN . '\") {token}}","variables":null}';

        $client = static::sendApiQuery($query);
        $response = $client->getResponse();
        $json = json_decode($response->getContent());

        self::assertEquals(ValidToken::TOKEN, $json->data->checkToken->token);
    }

    public function testCheckTokenInvalid()
    {
        $query = '{"query":"{checkToken(token: \"a1b2c3d4\") {token}}","variables":null}';

        $client = static::sendApiQuery($query);
        $response = $client->getResponse();
        $json = json_decode($response->getContent());

        self::assertCount(0, $json->data);
        self::assertEquals('Token is invalid', $json->errors[0]->message);
    }

    /**
     * @throws \Doctrine\Common\DataFixtures\OutOfBoundsException
     */
    public function testDeleteTaskWithAccess()
    {
        /** @var Task $task */
        $task = $this->fixtures->getReference('task-with-access');
        $id = $task->getId();
        $title = $task->getTitle();

        $query = '{"query":"mutation {\n deleteTask {\n task(task_id: ' . $id . ') {\n title\n }\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $json = json_decode($response->getContent());

        self::assertEquals($title, $json->data->deleteTask->task->title);
    }

    /**
     * @throws \Doctrine\Common\DataFixtures\OutOfBoundsException
     */
    public function testDeleteTaskWithoutAccess()
    {
        /** @var Task $task */
        $task = $this->fixtures->getReference('task-with-no-access');
        $id = $task->getId();

        $query = '{"query":"mutation {\n deleteTask {\n task(task_id: ' . $id . ') {\n title\n }\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $json = json_decode($response->getContent());

        self::assertEquals('Task with id=' . $id . ' not found!', $json->errors[0]->message);
    }

    public function testCreateTasklist()
    {
        $tasklistName = 'new tasklist name';
        $query = '{"query":"mutation {\n\tcreateTasklist{\n tasklist(name: \"' . $tasklistName . '\"){\n id\n name\n }\n }\n}","variables":null}';

        $client = static::sendApiQuery($query, ValidToken::TOKEN);
        $response = $client->getResponse();
        $json = json_decode($response->getContent());

        self::assertEquals($tasklistName, $json->data->createTasklist->tasklist->name);
    }
}
