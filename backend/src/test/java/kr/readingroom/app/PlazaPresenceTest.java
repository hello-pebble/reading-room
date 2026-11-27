package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.ArrayList;
import java.util.List;
import kr.readingroom.app.village.PlazaPresence;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

/** 광장 접속 인원 GET /plaza/presence (SSE, 결정 #91): 연결한 동안 접속으로 세고, 바뀔 때마다 모두에게 명단을 보낸다 */
class PlazaPresenceTest extends ApiTestBase {
    @Autowired PlazaPresence presence;
    private final List<MvcResult> open = new ArrayList<>();

    MvcResult connect(long uid) throws Exception {
        MvcResult r = mvc.perform(GET(uid, "/plaza/presence")).andExpect(request().asyncStarted()).andReturn();
        open.add(r);
        return r;
    }

    /** 화면이 연결을 끊은 것처럼 비동기 요청을 끝낸다 */
    void leave(MvcResult r) {
        r.getRequest().getAsyncContext().complete();
        open.remove(r);
    }

    /** 마지막으로 받은 presence 이벤트의 data 한 줄 */
    String last(MvcResult r) throws Exception {
        String all = r.getResponse().getContentAsString();
        int i = all.lastIndexOf("event:presence");
        assertThat(i).as("presence 이벤트를 받았어요").isGreaterThanOrEqualTo(0);
        String rest = all.substring(i);
        int d = rest.indexOf("data:");
        return rest.substring(d + 5, rest.indexOf('\n', d)).trim();
    }

    @AfterEach
    void closeAll() {
        new ArrayList<>(open).forEach(this::leave); // 연결은 메모리에 남으므로 다음 테스트로 새지 않게 끊는다
    }

    @Test
    void listsPeopleInPlazaAndUpdatesEveryoneOnJoinAndLeave() throws Exception {
        long a = newUser("alice"), b = newUser("bob");
        MvcResult ra = connect(a);
        assertThat(ra.getResponse().getContentType()).startsWith("text/event-stream");
        assertThat(last(ra)).contains(publicId(a)).contains("\"nickname\":\"alice\"").contains("\"avatar\":{").doesNotContain(publicId(b));

        MvcResult rb = connect(b);
        assertThat(last(ra)).contains(publicId(a)).contains(publicId(b));   // 먼저 온 사람도 새 명단을 받는다
        assertThat(last(rb)).contains(publicId(a)).contains(publicId(b));
        assertThat(presence.members()).hasSize(2);

        leave(ra);
        assertThat(last(rb)).contains(publicId(b)).doesNotContain(publicId(a));
        assertThat(presence.members()).hasSize(1);
    }

    @Test
    void samePersonInTwoTabsCountsOnce() throws Exception {
        long a = newUser("alice");
        MvcResult t1 = connect(a), t2 = connect(a);
        assertThat(presence.members()).hasSize(1);
        leave(t1);
        assertThat(presence.members()).hasSize(1);   // 다른 탭이 아직 광장에 있다
        leave(t2);
        assertThat(presence.members()).isEmpty();
    }

    @Test
    void internalIdsAreNotSentAndLoginIsRequired() throws Exception {
        long a = newUser("alice");
        assertThat(last(connect(a))).doesNotContain("\"id\"").doesNotContain("userId");   // 공개 번호로만 가리킨다 (결정 #69)
        mvc.perform(get("/plaza/presence")).andExpect(status().isUnauthorized());
    }
}
