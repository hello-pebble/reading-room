package kr.readingroom.app.room;

import kr.readingroom.app.common.UserIdFilter;
import kr.readingroom.app.room.dto.LeaveStayResponse;
import kr.readingroom.app.room.dto.StayResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 모닥불(공유방 장면) 입장·퇴장 — 머문 시간 기록 (결정 #65) */
@RestController
@RequestMapping("/rooms/{id}/stay")
public class CampStayController {
    private final CampStayService stays;

    public CampStayController(CampStayService stays) {
        this.stays = stays;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StayResponse enter(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        return stays.enter(uid, id);
    }

    @PostMapping("/leave")
    public LeaveStayResponse leave(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        return stays.leave(uid, id);
    }
}
