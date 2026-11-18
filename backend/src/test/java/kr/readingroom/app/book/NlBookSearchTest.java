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
