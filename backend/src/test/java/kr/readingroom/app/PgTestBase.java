package kr.readingroom.app;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * 모든 통합 테스트가 공유하는 실제 PostgreSQL.
 * 환경변수 TEST_DATABASE_URL 이 있으면 그 DB를 쓰고, 없으면 Docker 없이 zonky embedded-postgres를 띄운다
 * (PostgreSQL은 루트 사용자로 실행되지 않으므로 일반 사용자로 돌려야 한다).
 */
public abstract class PgTestBase {
    static final String EXTERNAL = System.getenv("TEST_DATABASE_URL");
    static final EmbeddedPostgres PG;
    static {
        try {
            PG = EXTERNAL == null ? EmbeddedPostgres.builder().start() : null;
            if (EXTERNAL != null) { // 외부 DB는 실행마다 비운 뒤 Flyway가 다시 만든다
                try (var c = java.sql.DriverManager.getConnection(EXTERNAL,
                        System.getenv().getOrDefault("TEST_DATABASE_USER", "postgres"),
                        System.getenv().getOrDefault("TEST_DATABASE_PASSWORD", "postgres"));
                     var st = c.createStatement()) {
                    st.execute("drop schema public cascade; create schema public");
                }
            }
        } catch (IOException | java.sql.SQLException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        if (EXTERNAL != null) {
            r.add("spring.datasource.url", () -> EXTERNAL);
            r.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DATABASE_USER", "postgres"));
            r.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DATABASE_PASSWORD", "postgres"));
        } else {
            r.add("spring.datasource.url", () -> PG.getJdbcUrl("postgres", "postgres"));
            r.add("spring.datasource.username", () -> "postgres");
            r.add("spring.datasource.password", () -> "postgres");
        }
    }
}
