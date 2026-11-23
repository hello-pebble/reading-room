package kr.readingroom.app.book;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** 제목 검색은 카카오가 먼저, 안 되면 국립중앙도서관. ISBN·저자 검색은 국립중앙도서관만 (네트워크 없음). */
class TitleFirstBookSearchTest {
    private static List<Map<String, Object>> one(String title, String source) {
        return List.of(Map.of("title", title, "author", source, "totalPages", 0, "isbn", "9788900000000", "coverUrl", ""));
    }

    /** 부른 기록을 남기는 가짜 소스들 */
    static class Fakes {
        final List<String> calls = new ArrayList<>();
        boolean kakaoOn = true;
        List<Map<String, Object>> kakaoResult = one("카카오 결과", "kakao");
        RuntimeException kakaoError;

        final NlBookSearch nl = new NlBookSearch("") {
            @Override public List<Map<String, Object>> search(String field, String value) {
                calls.add("nl:" + field);
                return one("국립 결과", "nl");
            }
        };
        final KakaoBookSearch kakao = new KakaoBookSearch("") {
            @Override public boolean enabled() { return kakaoOn; }
            @Override public List<Map<String, Object>> searchTitle(String q) {
                calls.add("kakao");
                if (kakaoError != null) throw kakaoError;
                return kakaoResult;
            }
        };
        final TitleFirstBookSearch search = new TitleFirstBookSearch(nl, kakao);
    }

    @Test
    void titleSearchUsesKakaoWhenItIsConfiguredAndAnswers() {
        Fakes f = new Fakes();
        assertThat(f.search.search("title", "모모")).extracting(m -> m.get("title")).containsExactly("카카오 결과");
        assertThat(f.calls).containsExactly("kakao");
    }

    @Test
    void anEmptyKakaoAnswerFallsBackToTheNationalLibrary() {
        Fakes f = new Fakes();
        f.kakaoResult = List.of();
        assertThat(f.search.search("title", "모모")).extracting(m -> m.get("title")).containsExactly("국립 결과");
        assertThat(f.calls).containsExactly("kakao", "nl:title");
    }

    @Test
    void aKakaoFailureFallsBackInsteadOfFailingTheSearch() {
        Fakes f = new Fakes();
        f.kakaoError = new ApiException(HttpStatus.BAD_GATEWAY, "SEARCH_FAILED", "실패");
        assertThat(f.search.search("title", "모모")).extracting(m -> m.get("title")).containsExactly("국립 결과");
        f.kakaoError = new IllegalStateException("연결 끊김");
        assertThat(f.search.search("title", "모모")).extracting(m -> m.get("title")).containsExactly("국립 결과");
    }

    @Test
    void withoutAKakaoKeyEverythingGoesToTheNationalLibrary() {
        Fakes f = new Fakes();
        f.kakaoOn = false;
        assertThat(f.search.search("title", "모모")).extracting(m -> m.get("title")).containsExactly("국립 결과");
        assertThat(f.calls).containsExactly("nl:title");
    }

    @Test
    void isbnAndAuthorSearchesNeverTouchKakaoBecauseOnlyTheLibraryKnowsThePages() {
        Fakes f = new Fakes();
        f.search.search("isbn", "9788908033254");
        f.search.search("author", "한강");
        assertThat(f.calls).containsExactly("nl:isbn", "nl:author");
    }
}
