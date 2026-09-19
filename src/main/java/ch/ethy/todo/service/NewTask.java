package ch.ethy.todo.service;

import ch.ethy.todo.domain.TaskZone;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public record NewTask(
    String title,
    TaskZone zone,
    String notes,
    LocalDate dueDate,
    Collection<String> labels,
    String clientRef) {

  public NewTask {
    labels = labels == null ? List.of() : List.copyOf(labels);
  }
}
