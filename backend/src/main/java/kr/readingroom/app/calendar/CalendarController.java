package kr.readingroom.app.calendar;

import kr.readingroom.app.calendar.dto.*;
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
    public CalendarResponse get(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestParam(required = false) String month) {
        return calendar.get(uid, month);
    }

    /** 한국 날짜 하루의 읽은 시간(분). date를 생략하면 오늘 (결정 #65) */
    @GetMapping("/me/reading-time")
    public ReadingTimeResponse readingTime(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestParam(required = false) String date) {
        return calendar.readingTime(uid, date);
    }
}
