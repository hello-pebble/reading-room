package kr.readingroom.app.neighbor;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.Db;
import kr.readingroom.app.common.RequestJson;
import kr.readingroom.app.neighbor.dto.HouseResponse;
import kr.readingroom.app.neighbor.dto.RecommendRequest;
import kr.readingroom.app.neighbor.dto.RecommendationResponse;
import kr.readingroom.app.neighbor.dto.RecommendedBook;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이웃집 책 추천 (결정 #49·#62): 읽는 중이거나 완독한 내 책 한 권을 이웃집 책장 아래 칸에 꽂아 둔다. 보낸 사람은 닉네임으로 밝힌다.
 * 집마다 확인 전 추천은 한 권(DB 부분 유니크 인덱스로 동시 요청에도 보장), 집 주인만 확인하며, 내 책과 기록은 바꾸지 않는다.
 */
@Service
public class NeighborService {
    /** 추천할 수 있는 책 상태: 지금 읽는 책, 완독한 책. 포기·나중에 읽을 책은 제외한다 */
    private static final Set<String> ELIGIBLE = Set.of("READING", "DONE");
    private final NeighborRepository neighbors;
    private final Clock clock;

    public NeighborService(NeighborRepository neighbors, Clock clock) {
        this.neighbors = neighbors;
        this.clock = clock;
    }

    /** 이웃집 방문: 아래 칸이 비어 있는지, 내가 꽂은 책이 있는지 */
    public HouseResponse visit(long userId, String publicId) {
        Record house = house(userId, publicId);
        Record open = neighbors.findOpen(house.get("id", Long.class));
        boolean mine = open != null && open.get("from_user", Long.class) == userId;
        return new HouseResponse(house.get("public_id", String.class), house.get("nickname", String.class), open != null, mine, mine ? book(open) : null);
    }

    /** 내 책 한 권을 그 집에 꽂는다. 자격은 꽂는 순간의 책 상태로 다시 검사한다. */
    @Transactional
    public RecommendationResponse recommend(long userId, String publicId, RecommendRequest body) {
        long bookId = bookId(body.bookId());
        Record house = house(userId, publicId);
        Record book = neighbors.findOwnedBook(bookId, userId);
        if (book == null) throw new ApiException(HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND", "내 책을 찾을 수 없어요");
        if (!ELIGIBLE.contains(book.get("status", String.class)))
            throw new ApiException(HttpStatus.BAD_REQUEST, "BOOK_NOT_ELIGIBLE", "읽는 중이거나 다 읽은 책만 추천할 수 있어요");
        Long saved = neighbors.insert(house.get("id", Long.class), userId, book.get("isbn", String.class), book.get("title", String.class),
                book.get("author", String.class), book.get("cover_url", String.class), clock.instant());
        if (saved == null) throw new ApiException(HttpStatus.CONFLICT, "HOUSE_OCCUPIED", "아직 집 주인이 책을 확인하지 않았어요");
        return view(neighbors.findOpen(house.get("id", Long.class)));
    }

    /** 내 집에 도착한 확인 전 추천. 없으면 null (컨트롤러가 204로 답한다) */
    public RecommendationResponse mine(long userId) {
        Record open = neighbors.findOpen(userId);
        return open == null ? null : view(open);
    }

    /** 집 주인이 [확인했어요]: 칸이 비어 다시 추천받을 수 있다. 확인만으로 내 책장에 책을 더하지 않는다. */
    @Transactional
    public void confirm(long userId) {
        if (neighbors.confirm(userId, clock.instant()) == 0)
            throw new ApiException(HttpStatus.NOT_FOUND, "NO_RECOMMENDATION", "확인할 추천이 없어요");
    }

    /** 사용자 공개 번호: 8-4-4-4-12 모양의 UUID만 인정한다(대소문자 무시). UUID.fromString은 "1-1-1-1-1" 같은 느슨한 모양도 받아서 먼저 모양을 확인한다. */
    private static final java.util.regex.Pattern PUBLIC_ID = java.util.regex.Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    private Record house(long userId, String publicId) {
        // 번호 모양이 아니면 "없는 집"이다(500이 아니라 404)
        Record house = publicId != null && PUBLIC_ID.matcher(publicId).matches() ? neighbors.findHouse(java.util.UUID.fromString(publicId)) : null;
        if (house == null) throw new ApiException(HttpStatus.NOT_FOUND, "HOUSE_NOT_FOUND", "이웃집을 찾을 수 없어요");
        if (house.get("id", Long.class) == userId) throw new ApiException(HttpStatus.BAD_REQUEST, "OWN_HOUSE", "내 집에는 추천할 수 없어요");
        return house;
    }

    private static long bookId(JsonNode v) {
        if (!RequestJson.present(v) || !v.isIntegralNumber() || !v.canConvertToLong() || v.asLong() <= 0)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_BOOK_ID", "bookId가 올바르지 않아요");
        return v.asLong();
    }

    private static RecommendedBook book(Record r) {
        return new RecommendedBook(r.get("isbn", String.class), r.get("title", String.class), r.get("author", String.class), r.get("cover_url", String.class));
    }

    private static RecommendationResponse view(Record r) {
        Instant at = Db.instant(r, "created_at");
        return new RecommendationResponse(r.get("id", Long.class), r.get("from_nickname", String.class), book(r), at);
    }
}
