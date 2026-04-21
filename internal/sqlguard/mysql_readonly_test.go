package sqlguard

import (
	"errors"
	"testing"
)

func TestValidateMySQLReadonly_Accept(t *testing.T) {
	t.Parallel()

	cases := []string{
		"select 1",
		"SELECT * FROM t",
		" /* leading comment */ SELECT 1",
		"select 1;",
		"show tables",
		"SHOW DATABASES",
		"describe t",
		"DESC t",
		"explain select 1",
		"EXPLAIN SELECT * FROM t",
		"(select 1)",
		"with cte as (select 1 as a) select * from cte",
	}

	for _, sql := range cases {
		sql := sql
		t.Run(sql, func(t *testing.T) {
			t.Parallel()
			if err := ValidateMySQLReadonly(sql); err != nil {
				t.Fatalf("expected accept, got err=%v", err)
			}
		})
	}
}

func TestValidateMySQLReadonly_Reject(t *testing.T) {
	t.Parallel()

	type tc struct {
		sql     string
		wantErr error
	}

	cases := []tc{
		{sql: "insert into t(a) values (1)", wantErr: ErrNotReadonly},
		{sql: "update t set a=1", wantErr: ErrNotReadonly},
		{sql: "delete from t where id=1", wantErr: ErrNotReadonly},
		{sql: "create table t(id int)", wantErr: ErrNotReadonly},
		{sql: "drop table t", wantErr: ErrNotReadonly},
		{sql: "use db1", wantErr: ErrNotReadonly},
		{sql: "select 1; select 2", wantErr: ErrMultiStmt},
		{sql: "select 1; /* trailing */ select 2", wantErr: ErrMultiStmt},
	}

	for _, c := range cases {
		c := c
		t.Run(c.sql, func(t *testing.T) {
			t.Parallel()
			err := ValidateMySQLReadonly(c.sql)
			if err == nil {
				t.Fatalf("expected reject (%v), got nil", c.wantErr)
			}
			if !errors.Is(err, c.wantErr) {
				t.Fatalf("expected errors.Is(err,%v)=true, got err=%v", c.wantErr, err)
			}
		})
	}
}

