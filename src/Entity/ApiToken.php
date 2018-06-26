<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * ApiToken
 *
 * @ORM\Table(name="api_token")
 * @ORM\Entity(repositoryClass="App\Repository\ApiTokenRepository")
 */
class ApiToken
{
    /**
     * @var int
     *
     * @ORM\Column(name="id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="AUTO")
     */
    private $id;

    /**
     * @var string
     *
     * @ORM\Column(name="token", type="string", length=255)
     */
    private $token;

    /**
     * @var string
     *
     * @ORM\Column(name="salt", type="string", length=255)
     */
    private $salt;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="validUntil", type="datetime")
     */
    private $validUntil;

    /**
     * @var User
     *
     * @ORM\ManyToOne(targetEntity="User", inversedBy="tokens")
     * @ORM\JoinColumn(name="user_id", referencedColumnName="id", onDelete="CASCADE")
     */
    private $user;

    /**
     * Get id
     *
     * @return int
     */
    public function getId()
    {
        return $this->id;
    }

    public function getToken()
    {
        return $this->token;
    }

    /**
     * Set token
     *
     * @param string $token
     *
     * @return ApiToken
     */
    public function setToken($token)
    {
        $this->salt = bin2hex(openssl_random_pseudo_bytes(16));
        $this->token = hash('sha512', $this->salt . $token);

        return $this;
    }

    /**
     * @param $token
     *
     * @return bool
     */
    public function checkTokenString($token)
    {
        $hash = hash('sha512', $this->salt . $token);

        return $this->token === $hash;
    }

    /**
     * Get salt
     *
     * @return string
     */
    public function getSalt()
    {
        return $this->salt;
    }

    /**
     * Set validUntil
     *
     * @param \DateTime $validUntil
     *
     * @return ApiToken
     */
    public function setValidUntil($validUntil)
    {
        $this->validUntil = $validUntil;

        return $this;
    }

    /**
     * Get validUntil
     *
     * @return \DateTime
     */
    public function getValidUntil()
    {
        return $this->validUntil;
    }

    /**
     * Set user
     *
     * @param User $user
     *
     * @return ApiToken
     */
    public function setUser($user)
    {
        if ($this->user !== $user) {
            if ($this->user !== null) {
                $this->user->removeApiToken($this);
            }

            $this->user = $user;

            if ($this->user !== null) {
                $this->user->addApiToken($this);
            }
        }

        return $this;
    }

    /**
     * Get user
     *
     * @return User
     */
    public function getUser()
    {
        return $this->user;
    }
}
