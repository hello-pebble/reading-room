package kr.readingroom.app.room;

import kr.readingroom.app.common.UserIdFilter;
import kr.readingroom.app.room.dto.AgreeResponse;
import kr.readingroom.app.room.dto.AlarmResponse;
import kr.readingroom.app.room.dto.CloseRoomResponse;
import kr.readingroom.app.room.dto.CreateRoomRequest;
import kr.readingroom.app.room.dto.InvitePreviewResponse;
import kr.readingroom.app.room.dto.JoinRoomRequest;
import kr.readingroom.app.village.dto.RoomResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** 공유방(모닥불) 개설·초대·입장·닫기·나가기·보관 동의. 마을 게시판 읽기(GET /rooms)는 village.BoardController. */
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

    /** 새로 들어오면 201, 이미 참여 중이면 200(멱등) */
    @PostMapping("/join")
    public ResponseEntity<RoomResponse> join(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestBody JoinRoomRequest body) {
        RoomService.Joined j = rooms.join(uid, body);
        return ResponseEntity.status(j.created() ? HttpStatus.CREATED : HttpStatus.OK).body(j.room());
    }

    /** 개방 알림 켜기: 새로 켜면 201, 이미 켜져 있으면 200 */
    @PutMapping("/{id}/alarm")
    public ResponseEntity<AlarmResponse> alarmOn(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        boolean created = rooms.alarmOn(uid, id);
        return ResponseEntity.status(created ? HttpStatus.CREATED : HttpStatus.OK).body(new AlarmResponse(id, true));
    }

    @DeleteMapping("/{id}/alarm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void alarmOff(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        rooms.alarmOff(uid, id);
    }

    @DeleteMapping("/{id}/participants/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        rooms.leave(uid, id);
    }

    @PostMapping("/{id}/agree")
    public AgreeResponse agree(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id) {
        return rooms.agree(uid, id);
    }
}
