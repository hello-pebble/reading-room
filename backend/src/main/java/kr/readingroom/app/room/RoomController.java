package kr.readingroom.app.room;

import kr.readingroom.app.common.UserIdFilter;
import kr.readingroom.app.room.dto.CloseRoomResponse;
import kr.readingroom.app.room.dto.CreateRoomRequest;
import kr.readingroom.app.room.dto.InvitePreviewResponse;
import kr.readingroom.app.village.dto.RoomResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** 공유방(모닥불) 개설·초대·닫기. 마을 게시판 읽기(GET /rooms)는 village.BoardController. */
@RestController
@RequestMapping("/rooms")
public class RoomController {
    private final RoomService rooms;

    public RoomController(RoomService rooms) {
        this.rooms = rooms;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse create(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody CreateRoomRequest body) {
        return rooms.create(uid, body);
    }

    /** 로그인 헤더 없이 열린다 (UserIdFilter 예외) */
    @GetMapping("/invite/{code}")
    public InvitePreviewResponse preview(@PathVariable String code) {
        return rooms.preview(code);
    }

    @PostMapping("/{id}/close")
    public CloseRoomResponse close(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        return rooms.close(uid, id);
    }
}
