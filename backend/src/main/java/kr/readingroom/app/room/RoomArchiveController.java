package kr.readingroom.app.room;

import java.util.List;
import kr.readingroom.app.common.UserIdFilter;
import kr.readingroom.app.room.dto.ArchiveResponse;
import kr.readingroom.app.room.dto.ImportRoomRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** 내 서재로 가져오기와 책의 공유방 탭 */
@RestController
public class RoomArchiveController {
    private final RoomArchiveService archives;

    public RoomArchiveController(RoomArchiveService archives) {
        this.archives = archives;
    }

    /** body는 생략할 수 있다. 새로 가져오면 201, 이미 가져온 방이면 200(멱등) */
    @PostMapping("/rooms/{id}/import")
    public ResponseEntity<ArchiveResponse> importRoom(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long id,
                                                      @RequestBody(required = false) ImportRoomRequest body) {
        RoomArchiveService.Imported r = archives.importRoom(uid, id, body == null ? new ImportRoomRequest(null) : body);
        return ResponseEntity.status(r.created() ? HttpStatus.CREATED : HttpStatus.OK).body(r.archive());
    }

    /** 책 상세의 [공유방] 탭 */
    @GetMapping("/books/{bookId}/rooms")
    public List<ArchiveResponse> byBook(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable long bookId) {
        return archives.byBook(uid, bookId);
    }
}
