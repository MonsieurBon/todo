<?php

namespace AppBundle\Controller;

use AppBundle\Schema\Types;
use FOS\RestBundle\Controller\Annotations as Rest;
use GraphQL\GraphQL;
use GraphQL\Type\Schema;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;

/**
 * Class ApiController
 *
 * @Route("/api")
 *
 * @package AppBundle\Controller
 */
class ApiController extends Controller
{
    /**
     * @Rest\Post("", defaults={"_format" = "json"}, options={"expose" = true})
     * @param Request $request
     * @return array
     */
    public function indexAction(Request $request)
    {
        $schema = new Schema([
            'query' => Types::query($this->getDoctrine()),
            'mutation' => Types::mutation($this->getDoctrine())
        ]);

        $this->validateSchemaIfDebug($request, $schema);

        $query = $request->request->get('query');
        $variables = $request->request->get('variables');

        $input = [
            'query' => trim($query) === "" ? null : $query,
            'variables' => $variables === "" ? null : $variables
        ];

        if ($input['query'] === null) {
            $input['query'] = '{hello}';
        }

        $result = GraphQL::executeQuery(
            $schema,
            $input['query'],
            null,
            null,
            (array) $input['variables']
        );

        if (!empty($result->errors)) {
            $logger = $this->get('logger');
            $logger->error('GraphQL request failed!');
            $logger->error('    Query: ' . $query);
            $logger->error('    Variables: ' . $variables);
            foreach ($result->errors as $error) {
                $logger->error('    Message:', array('error' => $error->getMessage()));
            }
        }

        return $result->toArray();
    }

    private function validateSchemaIfDebug(Request $request, Schema $schema)
    {
        $debug_api = $request->query->get('debug_api');
        if ($debug_api === '1') {
            $schema->assertValid();
        }
    }

}
