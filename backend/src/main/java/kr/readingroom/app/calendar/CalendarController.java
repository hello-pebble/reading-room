package kr.readingroom.app.calendar;

import java.util.Map;
import kr.readingroom.app.common.UserIdFilter;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CalendarController {
    private final CalendarService calendar;

    public CalendarController(CalendarService calendar) {
        this.calendar = calendar;
    }

    @GetMapping("/me/calendar")
    public Map<String, Object> get(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestParam(required = false) String month) {
        return calendar.get(uid, month);
    }
}
