<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 29.09.17
 * Time: 06:40
 */

namespace AppBundle\Service;


use GraphQL\Executor\ExecutionResult;
use GraphQL\GraphQL;
use GraphQL\Type\Schema;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Request;

class GraphQLQueryExecutor
{
    private $logger;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    /**
     * @param Request $request
     * @param Schema $schema
     * @param null $defaultQuery
     * @return ExecutionResult
     */
    public function executeQuery(Request $request, Schema $schema, $defaultQuery = null)
    {
        $this->validateSchemaIfDebug($request, $schema);

        $query = $request->request->get('query');
        $variables = $request->request->get('variables');

        $input = [
            'query' => trim($query) === "" ? null : $query,
            'variables' => $variables === "" ? null : $variables
        ];

        if ($input['query'] === null && $defaultQuery !== null) {
            $input['query'] = $defaultQuery;
        }

        $result = GraphQL::executeQuery(
            $schema,
            $input['query'],
            null,
            null,
            (array) $input['variables']
        );

        if (!empty($result->errors)) {
            $this->logger->error('GraphQL request failed!');
            $this->logger->error('    Query: ' . $query);
            $this->logger->error('    Variables: ' . $variables);
            foreach ($result->errors as $error) {
                $this->logger->error('    Message:', array('error' => $error->getMessage()));
            }
        }

        return $result;
    }

    /**
     * @param Request $request
     * @param Schema $schema
     */
    private function validateSchemaIfDebug(Request $request, Schema $schema)
    {
        $debug_api = $request->query->get('debug_api');
        if ($debug_api === '1') {
            $schema->assertValid();
        }
    }
}