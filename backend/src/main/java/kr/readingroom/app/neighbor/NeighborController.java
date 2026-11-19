package kr.readingroom.app.neighbor;

import kr.readingroom.app.common.UserIdFilter;
import kr.readingroom.app.neighbor.dto.HouseResponse;
import kr.readingroom.app.neighbor.dto.RecommendRequest;
import kr.readingroom.app.neighbor.dto.RecommendationResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** 이웃집 방문과 책 추천(내 책을 꽂기), 내 집에 도착한 추천 확인 */
@RestController
public class NeighborController {
    private final NeighborService neighbors;

    public NeighborController(NeighborService neighbors) {
        this.neighbors = neighbors;
    }

    /** 집은 그 사람의 공개 번호(무작위 UUID)로 찾는다 (결정 #69) */
    @GetMapping("/neighbors/{publicId}")
    public HouseResponse visit(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable String publicId) {
        return neighbors.visit(uid, publicId);
    }

    @PostMapping("/neighbors/{publicId}/recommendation")
    @ResponseStatus(HttpStatus.CREATED)
    public RecommendationResponse recommend(@RequestAttribute(UserIdFilter.ATTR) long uid, @PathVariable String publicId, @RequestBody RecommendRequest body) {
        return neighbors.recommend(uid, publicId, body);
    }

    /** 내 집에 도착한 확인 전 추천(보낸 사람 닉네임 포함). 없으면 204 */
    @GetMapping("/me/recommendation")
    public ResponseEntity<RecommendationResponse> mine(@RequestAttribute(UserIdFilter.ATTR) long uid) {
        RecommendationResponse r = neighbors.mine(uid);
        return r == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(r);
    }

    /** 집 주인 본인만(경로가 내 집이라 다른 사람의 추천은 확인할 수 없다) */
    @PostMapping("/me/recommendation/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirm(@RequestAttribute(UserIdFilter.ATTR) long uid) {
        neighbors.confirm(uid);
    }
}
