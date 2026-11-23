package kr.readingroom.app.book;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 국립중앙도서관 응답 변환 (네트워크 없음) */
class NlBookSearchTest {
    @Test
    void parsesDocsAndDedupesByIsbn() throws Exception {
        String j = "{\"TOTAL_COUNT\":\"3\",\"docs\":[" +
                "{\"TITLE\":\"소년이 온다\",\"AUTHOR\":\"한강 지음\",\"PAGE\":\"215 p.\",\"EA_ISBN\":\"9788936434120\",\"TITLE_URL\":\"http://img/c.jpg\"}," +
                "{\"TITLE\":\"소년이 온다\",\"AUTHOR\":\"한강 지음\",\"PAGE\":\"215\",\"EA_ISBN\":\"9788936434120\"}," +
                "{\"TITLE\":\"토지\",\"VOL\":\"1\",\"AUTHOR\":\"박경리\",\"PAGE\":\"1,024쪽\",\"EA_ISBN\":\"\",\"SET_ISBN\":\"9788937460001\"}]}";
        List<Map<String, Object>> r = NlBookSearch.parse(new ObjectMapper().readTree(j));
        assertThat(r).hasSize(2);
        assertThat(r.get(0)).containsEntry("totalPages", 215).containsEntry("isbn", "9788936434120").containsEntry("coverUrl", "https://img/c.jpg");
        assertThat(r.get(1)).containsEntry("title", "토지 1").containsEntry("totalPages", 1024).containsEntry("isbn", "9788937460001");
    }

    /** 실제 응답(2026-11)에서 저자는 "저자 : 박경리", "지은이: 남기업,이진수"처럼 머리말이 붙어서 온다 */
    @Test
    void stripsTheRoleLabelInFrontOfTheAuthor() throws Exception {
        String j = "{\"docs\":[" +
                "{\"TITLE\":\"청소년 토지 4\",\"AUTHOR\":\"저자 : 박경리\",\"EA_ISBN\":\"9788954439497\"}," +
                "{\"TITLE\":\"토지배당\",\"AUTHOR\":\"지은이: 남기업,이진수,채은동\",\"EA_ISBN\":\"9791198026088\"}," +
                "{\"TITLE\":\"토지·임야 사정\",\"AUTHOR\":\"편저: 안재길\",\"EA_ISBN\":\"9788963764177\"}," +
                "{\"TITLE\":\"모모\",\"AUTHOR\":\"미하엘 엔데 지음/서석연 옮김\",\"EA_ISBN\":\"9788908033254\"}," +
                "{\"TITLE\":\"모모와 토토\",\"AUTHOR\":\"글: 허은실 ;그림: 김유대\",\"EA_ISBN\":\"9788901240916\"}," +
                "{\"TITLE\":\"이름 없음\",\"AUTHOR\":\"\",\"EA_ISBN\":\"9788900000000\"}]}";
        List<Map<String, Object>> r = NlBookSearch.parse(new ObjectMapper().readTree(j));
        assertThat(r).extracting(m -> m.get("author")).containsExactly(
                "박경리", "남기업,이진수,채은동", "안재길", "미하엘 엔데 지음/서석연 옮김", "허은실 ;그림: 김유대", "");
    }

    /** 제목 검색은 "포함" 검색이라 `모모`가 10번째 뒤로 밀린다: 같은 제목 → 검색어로 시작 → 나머지(API 순서) */
    @Test
    void ranksExactTitleFirstThenTitlesStartingWithTheQuery() throws Exception {
        StringBuilder j = new StringBuilder("{\"docs\":[");
        for (int i = 0; i < 12; i++) j.append("{\"TITLE\":\"모모수학 ").append(i).append("호\",\"AUTHOR\":\"저자 : 모모\",\"EA_ISBN\":\"97911930437").append(String.format("%02d", i)).append("\"},");
        j.append("{\"TITLE\":\"츠구모모\",\"AUTHOR\":\"하마다\",\"EA_ISBN\":\"9788960524538\"},")
         .append("{\"TITLE\":\"모모와 다큰 왕자\",\"AUTHOR\":\"엄혜선\",\"EA_ISBN\":\"9791198240880\"},")
         .append("{\"TITLE\":\"모모\",\"AUTHOR\":\"미하엘 엔데\",\"EA_ISBN\":\"9788908033254\"}]}");
        List<Map<String, Object>> r = NlBookSearch.parse(new ObjectMapper().readTree(j.toString()), "모모");
        assertThat(r).hasSize(10);
        assertThat(r.get(0)).containsEntry("title", "모모");
        assertThat(r.get(1)).containsEntry("title", "모모수학 0호"); // 시작하는 것들은 API 순서 그대로
        assertThat(r.get(2)).containsEntry("title", "모모수학 1호");
        assertThat(r.stream().map(m -> (String) m.get("title"))).doesNotContain("츠구모모"); // 시작하지 않는 것은 뒤로
    }

    @Test
    void rankingIgnoresSpacesAndLeavesOtherSearchesInApiOrder() throws Exception {
        String j = "{\"docs\":[" +
                "{\"TITLE\":\"어린 왕자 이야기\",\"AUTHOR\":\"a\",\"EA_ISBN\":\"9788900000001\"}," +
                "{\"TITLE\":\"어린왕자\",\"AUTHOR\":\"생텍쥐페리\",\"EA_ISBN\":\"9788900000002\"}]}";
        List<Map<String, Object>> byTitle = NlBookSearch.parse(new ObjectMapper().readTree(j), "어린 왕자");
        assertThat(byTitle.get(0)).containsEntry("title", "어린왕자");
        List<Map<String, Object>> plain = NlBookSearch.parse(new ObjectMapper().readTree(j));
        assertThat(plain.get(0)).containsEntry("title", "어린 왕자 이야기");
    }

    @Test
    void pagesOutOfRangeOrMissingAreNull() {
        assertThat(NlBookSearch.pages("")).isNull();
        assertThat(NlBookSearch.pages("0")).isNull();
        assertThat(NlBookSearch.pages("12000")).isNull();
        assertThat(NlBookSearch.pages("xii, 300 p.")).isEqualTo(300);
    }

    @Test
    void emptyResponseGivesEmptyList() throws Exception {
        assertThat(NlBookSearch.parse(new ObjectMapper().readTree("{\"TOTAL_COUNT\":\"0\"}"))).isEmpty();
    }
}
