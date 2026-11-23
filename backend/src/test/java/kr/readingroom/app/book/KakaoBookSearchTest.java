package kr.readingroom.app.book;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 카카오 책 검색 응답 변환 (네트워크 없음). 응답 필드는 카카오 개발자 문서(daum-search 책 검색)의 목록을 따른다. */
class KakaoBookSearchTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void parsesTheDocumentsIntoTheScreenShape() throws Exception {
        String j = "{\"meta\":{\"total_count\":2,\"pageable_count\":2,\"is_end\":true},\"documents\":[" +
                "{\"title\":\"모모\",\"contents\":\"소개\",\"url\":\"https://search.daum.net/x\",\"isbn\":\"8908033254 9788908033254\"," +
                "\"datetime\":\"2005-08-25T00:00:00.000+09:00\",\"authors\":[\"미하엘 엔데\"],\"publisher\":\"비룡소\",\"translators\":[\"서석연\"]," +
                "\"price\":9000,\"sale_price\":-1,\"thumbnail\":\"https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=a.jpg\",\"status\":\"\"}," +
                "{\"title\":\"채식주의자\",\"authors\":[\"한강\",\"공저자\"],\"isbn\":\"9788936433598\",\"thumbnail\":\"\"}]}";
        List<Map<String, Object>> r = KakaoBookSearch.parse(JSON.readTree(j));
        assertThat(r).hasSize(2);
        assertThat(r.get(0)).containsEntry("title", "모모").containsEntry("author", "미하엘 엔데").containsEntry("isbn", "9788908033254")
                .containsEntry("coverUrl", "https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=a.jpg");
        assertThat(r.get(0).get("totalPages")).as("카카오 응답에는 쪽수가 없다").isNull();
        assertThat(r.get(1)).containsEntry("author", "한강, 공저자").containsEntry("isbn", "9788936433598").containsEntry("coverUrl", "");
    }

    @Test
    void prefersTheThirteenDigitIsbnAndFallsBackToTheTenDigitOne() throws Exception {
        String j = "{\"documents\":[" +
                "{\"title\":\"a\",\"isbn\":\"894970322X 9788949703220\",\"authors\":[]}," +
                "{\"title\":\"b\",\"isbn\":\"8908033262\",\"authors\":[]}," +
                "{\"title\":\"c\",\"isbn\":\" 9788908033262\",\"authors\":[]}," +
                "{\"title\":\"d\",\"isbn\":\"\",\"authors\":[]}]}";
        List<Map<String, Object>> r = KakaoBookSearch.parse(JSON.readTree(j));
        assertThat(r).extracting(m -> m.get("isbn")).containsExactly("9788949703220", "8908033262", "9788908033262", "");
    }

    @Test
    void dropsDuplicatesAndUntitledAndKeepsAtMostTen() throws Exception {
        StringBuilder j = new StringBuilder("{\"documents\":[{\"title\":\"\",\"isbn\":\"9788900000000\"},");
        j.append("{\"title\":\"같은 책\",\"isbn\":\"9788900000001\"},{\"title\":\"같은 책\",\"isbn\":\"9788900000001\"},");
        for (int i = 0; i < 14; i++) j.append("{\"title\":\"책 ").append(i).append("\",\"isbn\":\"97889000010").append(String.format("%02d", i)).append("\"},");
        j.setLength(j.length() - 1);
        j.append("]}");
        List<Map<String, Object>> r = KakaoBookSearch.parse(JSON.readTree(j.toString()));
        assertThat(r).hasSize(10);
        assertThat(r.get(0)).containsEntry("title", "같은 책");
        assertThat(r.stream().filter(m -> "같은 책".equals(m.get("title"))).count()).isEqualTo(1);
    }

    @Test
    void emptyOrUnexpectedResponsesGiveAnEmptyList() throws Exception {
        assertThat(KakaoBookSearch.parse(JSON.readTree("{\"meta\":{\"total_count\":0},\"documents\":[]}"))).isEmpty();
        assertThat(KakaoBookSearch.parse(JSON.readTree("{\"errorType\":\"AccessDeniedError\"}"))).isEmpty();
    }
}
