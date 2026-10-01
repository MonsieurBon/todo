package ch.ethy.todo.service;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskZone;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * What a filter shows, and how full each zone is whatever it shows, as of {@code today} - the day
 * its tasks have to be described by too.
 */
public record Board(List<Task> tasks, Map<TaskZone, Long> loads, LocalDate today) {}
