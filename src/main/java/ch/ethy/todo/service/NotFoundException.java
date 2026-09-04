package ch.ethy.todo.service;

/**
 * Raised when a resource does not exist <em>or</em> the caller may not see it. The two cases are
 * deliberately indistinguishable: answering 403 for someone else's list would confirm that the id
 * exists, which is a small but free information leak.
 */
public class NotFoundException extends RuntimeException {
  public NotFoundException(String message) {
    super(message);
  }
}
