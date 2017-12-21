<?php

namespace App\Security;

use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Component\Security\Core\Authentication\Token\PreAuthenticatedToken;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Core\User\UserProviderInterface;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;
use Symfony\Component\Security\Http\Authentication\SimplePreAuthenticatorInterface;

class TokenAuthenticator implements SimplePreAuthenticatorInterface, AuthenticationFailureHandlerInterface
{
    const TOKEN = 'token';
    const URL_PARAMETER_TOKEN = self::TOKEN;
    const X_AUTH_HEADER = 'X-AUTH-TOKEN';

    /** @var ContainerInterface */
    private $container;
    /** @var RegistryInterface */
    private $doctrine;
    /** @var HttpKernelInterface */
    private $kernel;

    public function __construct(
        ContainerInterface $container,
        HttpKernelInterface $kernel,
        RegistryInterface $doctrine
    ) {
        $this->container = $container;
        $this->doctrine = $doctrine;
        $this->kernel = $kernel;
    }

    public function createToken(Request $request, $providerKey)
    {
        $token = $request->headers->get(self::X_AUTH_HEADER);
        if (!$token) {
            $token = $request->query->get(self::URL_PARAMETER_TOKEN);
        }

        return new PreAuthenticatedToken(
            'anon.',
            $token,
            $providerKey
        );
    }

    public function supportsToken(TokenInterface $token, $providerKey)
    {
        return $token instanceof PreAuthenticatedToken && $token->getProviderKey() === $providerKey;
    }

    public function authenticateToken(TokenInterface $preAuthToken, UserProviderInterface $userProvider, $providerKey)
    {
        if (!$userProvider instanceof TokenUserProvider) {
            throw new \InvalidArgumentException(
                sprintf(
                    'The user provider must be an instance of ApiKeyUserProvider (%s was given).',
                    get_class($userProvider)
                )
            );
        }

        $token = $preAuthToken->getCredentials();
        $user = $userProvider->getUserForToken($token);

        if (!$user) {
            throw new BadCredentialsException();
        }

        $sessionTimeout = $this->container->getParameter('app.session_timeout');
        $validUntil = (new \DateTime('now'))
            ->add(new \DateInterval('PT' . $sessionTimeout . 'M'));

        /* @var User $user */
        $user->getApiToken()->setValidUntil($validUntil);
        $this->doctrine->getManager()->flush();

        return new PreAuthenticatedToken(
            $user,
            $token,
            $providerKey,
            $user->getRoles()
        );
    }

    /**
     * This is called when an interactive authentication attempt fails. This is
     * called by authentication listeners inheriting from
     * AbstractAuthenticationListener.
     *
     * @param Request                 $request
     * @param AuthenticationException $exception
     *
     * @return Response The response to return, never null
     */
    public function onAuthenticationFailure(Request $request, AuthenticationException $exception)
    {
        $path['_forwarded'] = $request->attributes;
        $path['_controller'] = 'App\Controller\ApiController::loginAction';
        $subRequest = $request->duplicate(null, null, $path);

        return $this->kernel->handle($subRequest, HttpKernelInterface::SUB_REQUEST);
    }
}
