package ch.ethy.todo.push;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.service.Board;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.json.JsonMapper;

/** What a device's Critical Now notification says. */
record CriticalNowNotice(String title, String body) {

  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final int CAP = TaskZone.CRITICAL_NOW.softCap().orElseThrow();

  static CriticalNowNotice of(Board board) {
    List<String> titles =
        board.tasks().stream()
            .filter(task -> task.zone() == TaskZone.CRITICAL_NOW)
            .filter(task -> task.isOpen() && task.isVisibleOn(board.today()))
            .map(Task::title)
            .toList();
    if (titles.isEmpty()) {
      return new CriticalNowNotice("Critical Now", "Nothing critical right now");
    }
    int count = titles.size();
    String title =
        count > CAP
            ? "Critical Now (" + count + ", over the cap of " + CAP + ")"
            : "Critical Now (" + count + ")";
    for (int shown = count; ; shown--) {
      List<String> lines = new ArrayList<>(titles.subList(0, shown));
      if (shown < count) {
        lines.add("…and " + (count - shown) + " more");
      }
      var notice = new CriticalNowNotice(title, String.join("\n", lines));
      if (notice.payload().length <= WebPushEncryption.MAX_PLAINTEXT) {
        return notice;
      }
    }
  }

  /**
   * Under a key Angular's worker ignores: ours shows it, so that it can show something else for a
   * device that has signed out.
   */
  byte[] payload() {
    return JSON.writeValueAsString(new Payload(this)).getBytes(StandardCharsets.UTF_8);
  }

  /** Records, not maps: the same notice must be the same bytes, or its digest would differ. */
  private record Payload(CriticalNowNotice criticalNow) {}
}
