FROM ubuntu:17.10

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        apt-utils

RUN apt-get install -y --no-install-recommends \
        apache2 \
        binutils \
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

RUN rm /var/www/html/index.html
COPY scripts/docker/000-default.conf /etc/apache2/sites-available/000-default.conf
COPY composer.json composer.lock /var/www/html/
RUN php composer.phar install --no-dev --no-scripts --no-plugins --no-autoloader
COPY scripts/docker/todo.init /var/www/html/todo.init
RUN chmod u+x /var/www/html/todo.init
COPY var /var/www/html/var/
COPY bin /var/www/html/bin/
COPY app /var/www/html/app/
COPY scripts/docker/parameters.yml /var/www/html/app/config/parameters.yml
COPY src /var/www/html/src/
COPY web /var/www/html/web/
RUN php composer.phar dump-autoload --optimize


EXPOSE 80
CMD ["/var/www/html/todo.init"]
