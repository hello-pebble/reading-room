package kr.readingroom.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** 화면 파일은 배포하면 바로 새 것이 쓰이게, 브라우저가 매번 서버에 최신인지 확인한다 (Cache-Control: no-cache, 결정 #100) */
class StaticCacheTest extends ApiTestBase {
    @Test
    void screenFilesAskTheBrowserToRevalidate() throws Exception {
        for (String path : new String[] {"/config.js", "/index.html"}) {
            MvcResult r = mvc.perform(get(path)).andExpect(status().isOk()).andReturn();
            assertThat(r.getResponse().getHeader("Cache-Control")).as(path).contains("no-cache");
        }
    }
}
