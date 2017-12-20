<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 05.11.17
 * Time: 13:32
 */

namespace App\Tests\EventSubscriber;


use App\EventSubscriber\CorsListener;
use PHPUnit\Framework\Assert;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\FilterResponseEvent;
use Symfony\Component\HttpKernel\Event\GetResponseEvent;

class CorsListenerTest extends TestCase
{
    public function testGetSubscribedEvents()
    {
        $subscribedEvents = CorsListener::getSubscribedEvents();

        self::assertCount(2, $subscribedEvents);
        self::assertNotNull($subscribedEvents['kernel.request']);
        self::assertNotNull($subscribedEvents['kernel.response']);
    }

    public function testOnKernelRequestNotMaster()
    {
        $listener = new CorsListener();

        /** @var GetResponseEvent $event */
        $event = $this->createMock(GetResponseEvent::class);
        $event->method('isMasterRequest')->willReturn(false);
        $event->expects(static::never())
            ->method('getRequest');
        $event->expects(static::never())
            ->method('setResponse');

        $listener->onKernelRequest($event);
    }

    public function testOnKernelRequestNotOptions()
    {
        $listener = new CorsListener();

        /** @var Request $request */
        $request = $this->createMock(Request::class);
        $request->method('getRealMethod')->willReturn('GET');
        /** @var GetResponseEvent $event */
        $event = $this->createMock(GetResponseEvent::class);
        $event->method('isMasterRequest')->willReturn(true);
        $event->method('getRequest')->willReturn($request);
        $event->expects(static::once())
            ->method('getRequest');
        $event->expects(static::never())
            ->method('setResponse');

        $listener->onKernelRequest($event);
    }

    public function testOnKernelRequestOptions()
    {
        $listener = new CorsListener();

        /** @var Request $request */
        $request = $this->createMock(Request::class);
        $request->method('getRealMethod')->willReturn('OPTIONS');
        /** @var GetResponseEvent $event */
        $event = $this->createMock(GetResponseEvent::class);
        $event->method('isMasterRequest')->willReturn(true);
        $event->method('getRequest')->willReturn($request);
        $event->expects(static::once())
            ->method('getRequest');
        $event->expects(static::once())
            ->method('setResponse')
            ->will(static::returnCallback(function($response) {
                Assert::assertNotNull($response);
                Assert::assertTrue($response instanceof Response);
            }));

        $listener->onKernelRequest($event);
    }

    public function testOnKernelResponseNotMaster()
    {
        $listener = new CorsListener();

        /** @var FilterResponseEvent $event */
        $event = $this->createMock(FilterResponseEvent::class);
        $event->method('isMasterRequest')->willReturn(false);
        $event->expects(static::never())
            ->method('getResponse');

        $listener->onKernelResponse($event);
    }

    public function testOnKernelResponseIsMaster()
    {
        $listener = new CorsListener();
        $response = new Response();

        /** @var FilterResponseEvent $event */
        $event = $this->createMock(FilterResponseEvent::class);
        $event->method('isMasterRequest')->willReturn(true);
        $event->method('getResponse')->willReturn($response);

        $listener->onKernelResponse($event);

        $origin = $response->headers->get('Access-Control-Allow-Origin');
        $methods = $response->headers->get('Access-Control-Allow-Methods');
        $headers = $response->headers->get('Access-Control-Allow-Headers');
        self::assertEquals('http://localhost:4200', $origin);
        self::assertEquals('POST', $methods);
        self::assertEquals('CONTENT-TYPE, X-AUTH-TOKEN', $headers);
    }
}