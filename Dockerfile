# Pinned by digest, not by tag: a tag is a moving target, and an image that changed
# underneath a release would make that release unreproducible.
FROM eclipse-temurin:25.0.4_7-jre@sha256:f9e65324a37f28209ce7dd0e5149a7aa954520ed936fb87813cf6ded2400a112

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
