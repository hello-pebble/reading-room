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

    /** 실제 응답(2026-11): ISBN 칸에 ISBN이 아닌 내부 코드(209…, 480…)가 오는 책이 있다 — ISBN으로 쓰지 않는다 */
    @Test
    void nonIsbnCodesInTheIsbnFieldAreIgnored() throws Exception {
        String j = "{\"documents\":[" +
                "{\"title\":\"채식주의자\",\"isbn\":\" 2090000157222\",\"authors\":[\"한강\"]}," +
                "{\"title\":\"모모\",\"isbn\":\" 4808949703404\",\"authors\":[\"엔데\"]}," +
                "{\"title\":\"모모\",\"isbn\":\"8949190028 9788949190020\",\"authors\":[\"엔데\"]}]}";
        List<Map<String, Object>> r = KakaoBookSearch.parse(JSON.readTree(j));
        assertThat(r).extracting(m -> m.get("isbn")).containsExactly("9788949190020", "", ""); // ISBN 있는 책이 앞(같은 책 공유방을 열 수 있다)
    }

    /**
     * 실제 응답(2026-11, `토지`): 정확도순에서 NCS 수험서가 『토지』보다 앞선다. 검색어가 든 제목만 뒤로 보내고,
     * 같은 제목·시작하는 제목은 카카오 순서를 그대로 둔다(정확히 `토지`인 다른 책이 박경리 『토지』 위로 오지 않게).
     */
    @Test
    void movesTitlesThatOnlyContainTheQueryBehindTheOnesThatStartWithItButKeepsTheKakaoOrderOtherwise() throws Exception {
        String j = "{\"documents\":[" +
                "{\"title\":\"독끝 NCS 기본서 (토지)\",\"isbn\":\"9791193369050\",\"authors\":[\"길잡이\"]}," +
                "{\"title\":\"토지 1(1부 1권)\",\"isbn\":\"9791130699462\",\"authors\":[\"박경리\"]}," +
                "{\"title\":\"난생처음 토지 투자\",\"isbn\":\"9791189089337\",\"authors\":[\"이라희\"]}," +
                "{\"title\":\"토지\",\"isbn\":\"9788960532410\",\"authors\":[\"박경리\"]}]}";
        List<Map<String, Object>> ranked = KakaoBookSearch.parse(JSON.readTree(j), "토지");
        assertThat(ranked).extracting(m -> m.get("title")).containsExactly("토지 1(1부 1권)", "토지", "독끝 NCS 기본서 (토지)", "난생처음 토지 투자");
        List<Map<String, Object>> plain = KakaoBookSearch.parse(JSON.readTree(j));
        assertThat(plain.get(0)).containsEntry("title", "독끝 NCS 기본서 (토지)"); // 검색어를 모르면 API 순서 그대로
    }

    @Test
    void emptyOrUnexpectedResponsesGiveAnEmptyList() throws Exception {
        assertThat(KakaoBookSearch.parse(JSON.readTree("{\"meta\":{\"total_count\":0},\"documents\":[]}"))).isEmpty();
        assertThat(KakaoBookSearch.parse(JSON.readTree("{\"errorType\":\"AccessDeniedError\"}"))).isEmpty();
    }
}
