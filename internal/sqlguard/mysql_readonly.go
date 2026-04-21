package sqlguard

import (
	"errors"
	"fmt"
	"strings"
)

var (
	// ErrNotReadonly is returned when the given SQL is not a read-only statement.
	ErrNotReadonly = errors.New("mysql: not readonly")
	// ErrMultiStmt is returned when the given SQL contains multiple statements.
	ErrMultiStmt = errors.New("mysql: multiple statements are not allowed")
)

// ValidateMySQLReadonly validates that sql is safe to run in "read-only query" mode.
//
// Rules:
// - Multi-statement SQL is forbidden (e.g. "select 1; select 2").
// - Allowed: SELECT, SHOW, DESCRIBE, EXPLAIN and OtherRead.
// - Everything else is rejected.
func ValidateMySQLReadonly(sql string) error {
	sql = strings.TrimSpace(sql)
	if sql == "" {
		return fmt.Errorf("%w: empty sql", ErrNotReadonly)
	}

	// 1) forbid multi-statement
	if hasMultipleStatements(sql) {
		return ErrMultiStmt
	}

	// 2) allowlist by leading keyword (after stripping leading comments/whitespace/parentheses)
	kw := firstKeyword(sql)
	switch kw {
	case "SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH":
		// Extra hardening: reject SELECT ... INTO OUTFILE / DUMPFILE (file write)
		lower := strings.ToLower(sql)
		if strings.Contains(lower, "into outfile") || strings.Contains(lower, "into dumpfile") {
			return ErrNotReadonly
		}
		return nil
	default:
		return fmt.Errorf("%w: leading_keyword=%s", ErrNotReadonly, kw)
	}
}

// hasMultipleStatements detects multiple SQL statements by scanning semicolons that are
// outside of quotes and comments. A single trailing semicolon is allowed.
func hasMultipleStatements(sql string) bool {
	inSingle, inDouble, inBacktick := false, false, false
	inLineComment, inBlockComment := false, false

	semicolonCount := 0
	lastSemicolonPos := -1

	for i := 0; i < len(sql); i++ {
		ch := sql[i]

		// end line comment
		if inLineComment {
			if ch == '\n' {
				inLineComment = false
			}
			continue
		}
		// end block comment
		if inBlockComment {
			if ch == '*' && i+1 < len(sql) && sql[i+1] == '/' {
				inBlockComment = false
				i++
			}
			continue
		}

		// inside quotes
		if inSingle {
			if ch == '\\' {
				i++
				continue
			}
			if ch == '\'' {
				inSingle = false
			}
			continue
		}
		if inDouble {
			if ch == '\\' {
				i++
				continue
			}
			if ch == '"' {
				inDouble = false
			}
			continue
		}
		if inBacktick {
			if ch == '`' {
				inBacktick = false
			}
			continue
		}

		// comment start
		if ch == '-' && i+1 < len(sql) && sql[i+1] == '-' {
			inLineComment = true
			i++
			continue
		}
		if ch == '#' {
			inLineComment = true
			continue
		}
		if ch == '/' && i+1 < len(sql) && sql[i+1] == '*' {
			inBlockComment = true
			i++
			continue
		}

		// quote start
		switch ch {
		case '\'':
			inSingle = true
			continue
		case '"':
			inDouble = true
			continue
		case '`':
			inBacktick = true
			continue
		case ';':
			semicolonCount++
			lastSemicolonPos = i
		}
	}

	if semicolonCount == 0 {
		return false
	}
	if semicolonCount > 1 {
		return true
	}

	// semicolonCount == 1: allow only if it's the last non-space char
	for i := lastSemicolonPos + 1; i < len(sql); i++ {
		if sql[i] != ' ' && sql[i] != '\t' && sql[i] != '\n' && sql[i] != '\r' {
			return true
		}
	}
	return false
}

func firstKeyword(sql string) string {
	// trim leading spaces/comments/parentheses
	i := 0
	for i < len(sql) {
		// skip whitespace
		for i < len(sql) && (sql[i] == ' ' || sql[i] == '\t' || sql[i] == '\n' || sql[i] == '\r') {
			i++
		}
		// skip parentheses
		for i < len(sql) && sql[i] == '(' {
			i++
			for i < len(sql) && (sql[i] == ' ' || sql[i] == '\t' || sql[i] == '\n' || sql[i] == '\r') {
				i++
			}
		}
		// line comment
		if i+1 < len(sql) && sql[i] == '-' && sql[i+1] == '-' {
			i += 2
			for i < len(sql) && sql[i] != '\n' {
				i++
			}
			continue
		}
		if i < len(sql) && sql[i] == '#' {
			i++
			for i < len(sql) && sql[i] != '\n' {
				i++
			}
			continue
		}
		// block comment
		if i+1 < len(sql) && sql[i] == '/' && sql[i+1] == '*' {
			i += 2
			for i+1 < len(sql) && !(sql[i] == '*' && sql[i+1] == '/') {
				i++
			}
			if i+1 < len(sql) {
				i += 2
			}
			continue
		}
		break
	}

	start := i
	for i < len(sql) {
		ch := sql[i]
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') {
			i++
			continue
		}
		break
	}
	if start == i {
		return ""
	}
	return strings.ToUpper(sql[start:i])
}
