package kr.readingroom.app.book;

import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * 책 검색의 기본 소스(결정 #83). 제목 검색은 카카오가 먼저 찾고(정확도), 키가 없거나 실패하거나 결과가 없으면 국립중앙도서관으로 넘어간다.
 * ISBN·저자 검색은 쪽수와 정확한 ISBN 조회가 되는 국립중앙도서관만 쓴다(카카오 응답에는 쪽수가 없다).
 */
@Primary
@Component
public class TitleFirstBookSearch implements BookSearchSource {
    private static final Logger log = LoggerFactory.getLogger(TitleFirstBookSearch.class);
    private final NlBookSearch nl;
    private final KakaoBookSearch kakao;

    public TitleFirstBookSearch(NlBookSearch nl, KakaoBookSearch kakao) {
        this.nl = nl;
        this.kakao = kakao;
    }

    @Override
    public List<Map<String, Object>> search(String field, String value) {
        if ("title".equals(field) && kakao.enabled()) {
            try {
                List<Map<String, Object>> r = kakao.searchTitle(value);
                if (!r.isEmpty()) return r;
            } catch (RuntimeException e) {
                log.warn("카카오 책 검색 실패, 국립중앙도서관으로 넘어갑니다: {}", e.getMessage()); // 키·검색어는 남기지 않는다
            }
        }
        return nl.search(field, value);
    }
}
