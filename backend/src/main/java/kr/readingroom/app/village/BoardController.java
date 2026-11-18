package kr.readingroom.app.village;

import java.util.List;
import kr.readingroom.app.common.UserIdFilter;
import kr.readingroom.app.village.dto.RoomResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BoardController {
    private final BoardService board;

    public BoardController(BoardService board) {
        this.board = board;
    }

    /** 마을 게시판·창문 소식: 내가 만들었거나 참여한 방 (베타는 공개 방이 없다, #41) */
    @GetMapping("/rooms")
    public List<RoomResponse> list(@RequestAttribute(UserIdFilter.ATTR) long uid, @RequestParam(required = false) String status) {
        return board.list(uid, status);
    }
}
