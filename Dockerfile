# Pinned by digest, not by tag, so the JRE a release runs on changes only through a
# deliberate bump. The OS packages move with every build, see below.
FROM eclipse-temurin:25.0.5_8-jre@sha256:ecdc0adb37bde1a281c4d245a3cd535004b1fc8322d560f5b09463b248c81df0

# The base image is rebuilt on its own schedule, behind Ubuntu's security fixes. A release
# build takes the OS packages as they are that day, so it ships whatever is fixed by then -
# at the price of two builds of one commit differing in them. That only holds while this
# layer is built afresh, hence --no-cache in the release. A failed fetch must fail the build:
# otherwise the upgrade finds nothing to do and the release ships unpatched.
RUN apt-get update --error-on=any \
 && DEBIAN_FRONTEND=noninteractive apt-get upgrade --yes --with-new-pkgs --no-install-recommends \
      -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold \
 && rm -rf /var/lib/apt/lists/*

# Nothing here needs root. The app writes no files - everything durable is in MySQL -
# so it does not even need to own its own directory.
RUN groupadd --system --gid 1001 todo \
 && useradd --system --uid 1001 --gid todo --no-create-home todo

WORKDIR /opt/app
COPY target/todo-*.jar /opt/app/todo.jar
COPY docker/healthcheck.sh /opt/app/healthcheck.sh

USER todo:todo

# The default. SERVER_PORT moves it, and the healthcheck follows.
EXPOSE 8080

# start-period covers Flyway plus the Spring context; the app is usually up in about
# fifteen seconds, and a slow first migration should not count as a failure.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD ["/opt/app/healthcheck.sh"]

# The JVM's default heap ceiling is a quarter of the container's memory, which wastes
# most of a small limit. JAVA_OPTS is the documented way to change this and anything
# else; `exec` keeps java as PID 1, so it still receives the signal to shut down.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /opt/app/todo.jar"]
