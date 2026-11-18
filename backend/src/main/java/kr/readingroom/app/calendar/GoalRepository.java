package kr.readingroom.app.calendar;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

/** SQL 실행만 담당한다. 검증·기능 규칙·트랜잭션 경계는 서비스에서 관리한다. */
@Repository
public class GoalRepository {
    private final DSLContext dsl;

    public GoalRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public int upsert(long userId, String month, int goal, String changes, String updatedAt) {
        return dsl.execute("""
                    insert into monthly_goal(user_id, year_month, goal, changes, updated_at) values (?, ?, ?, ?::jsonb, ?::timestamptz)
                    on conflict (user_id, year_month) do update set goal = excluded.goal, changes = excluded.changes, updated_at = excluded.updated_at""", userId, month, goal, changes, updatedAt);
    }

    public int insertDefault(long userId, String month, int goal, String updatedAt) {
        return dsl.execute("insert into monthly_goal(user_id, year_month, goal, updated_at) values (?, ?, ?, ?::timestamptz)", userId, month, goal, updatedAt);
    }

    public Record count(long userId) {
        return dsl.fetchOne("select count(*) from monthly_goal where user_id = ?", userId);
    }

    public Record findPrevious(long userId, String month) {
        return dsl.fetchOne("select goal from monthly_goal where user_id = ? and year_month < ? order by year_month desc limit 1", userId, month);
    }

    public Record find(long userId, String month) {
        return dsl.fetchOne("select goal, changes::text as changes from monthly_goal where user_id = ? and year_month = ?", userId, month);
    }
}
