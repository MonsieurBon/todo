FROM ubuntu:17.10

ENV APP_ENV=prod

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        apache2 \
        ca-certificates \
        curl \
        libapache2-mod-php \
        php \
        php-intl \
        php-mbstring \
        php-mysql \
        php-xml \
        php-zip && \
    apt-get autoclean

WORKDIR /var/www/html

RUN EXPECTED_SIGNATURE=$(curl https://composer.github.io/installer.sig) && \
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" && \
    ACTUAL_SIGNATURE=$(php -r "echo hash_file('SHA384', 'composer-setup.php');") && \
    if [ "$EXPECTED_SIGNATURE" != "$ACTUAL_SIGNATURE" ]; then >&2 echo 'ERROR: Invalid installer signature'; rm composer-setup.php; exit 1; fi && \
    php composer-setup.php --quiet && \
    rm composer-setup.php

COPY composer.json composer.lock /var/www/html/
RUN php composer.phar install --no-dev --no-scripts --no-plugins --no-autoloader
RUN rm /var/www/html/index.html
COPY scripts/docker/000-default.conf /etc/apache2/sites-available/000-default.conf
COPY scripts/docker/todo.init /var/www/html/todo.init
RUN chmod u+x /var/www/html/todo.init
COPY bin /var/www/html/bin/
COPY config /var/www/html/config/
COPY public /var/www/html/public
COPY src /var/www/html/src/
COPY templates /var/www/html/templates
COPY var /var/www/html/var/
RUN php composer.phar dump-autoload --optimize


EXPOSE 80
CMD ["/var/www/html/todo.init"]
