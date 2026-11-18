package kr.readingroom.app.calendar;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.web.bind.annotation.*;

@RestController
public class GoalController {
    private final GoalService goals;

    public GoalController(GoalService goals) {
        this.goals = goals;
    }

    /** 이번 달 목표만 바꾼다 (달 지정 없음). 같은 값을 다시 보내면 200. */
    @PutMapping("/me/goal")
    public Map<String, Object> put(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody JsonNode body) {
        return goals.set(uid, body);
    }

    @GetMapping("/me/goal")
    public Map<String, Object> get(@RequestAttribute(UserIdFilter.ATTR) long uid) {
        return goals.current(uid);
    }
}
