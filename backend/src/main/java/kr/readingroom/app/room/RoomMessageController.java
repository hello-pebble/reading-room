package kr.readingroom.app.room;

import java.util.List;
import kr.readingroom.app.common.UserIdFilter;
import kr.readingroom.app.room.dto.ReadResponse;
import kr.readingroom.app.room.dto.RoomMessageRequest;
import kr.readingroom.app.room.dto.RoomMessageResponse;
import kr.readingroom.app.room.dto.RoomParticipantResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** 공유방 대화: 글 목록·보내기와 읽음. 보낸 글의 삭제·수정 API는 없다(결정 #53). */
@RestController
@RequestMapping("/rooms/{id}")
public class RoomMessageController {
    private final RoomMessageService messages;

    public RoomMessageController(RoomMessageService messages) {
        this.messages = messages;
    }

    @GetMapping("/messages")
    public List<RoomMessageResponse> list(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id, @RequestParam(required = false) String after) {
        return messages.list(uid, id, after);
    }

    @PostMapping("/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomMessageResponse send(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id, @RequestBody RoomMessageRequest body) {
        return messages.send(uid, id, body);
    }

    /** 모닥불 참여자 명단 (결정 #92) */
    @GetMapping("/participants")
    public List<RoomParticipantResponse> participants(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        return messages.participants(uid, id);
    }

    @PostMapping("/read")
    public ReadResponse read(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        return messages.read(uid, id);
    }
}
