package redix

import "testing"

func TestTruncateString(t *testing.T) {
	t.Run("no_truncate", func(t *testing.T) {
		got, trunc := truncateString("hello", 5)
		if trunc {
			t.Fatalf("expected trunc=false, got true")
		}
		if got != "hello" {
			t.Fatalf("expected %q, got %q", "hello", got)
		}
	})

	t.Run("truncate_bytes", func(t *testing.T) {
		got, trunc := truncateString("hello world", 5)
		if !trunc {
			t.Fatalf("expected trunc=true, got false")
		}
		if got != "hello" {
			t.Fatalf("expected %q, got %q", "hello", got)
		}
	})

	t.Run("maxBytes_zero", func(t *testing.T) {
		got, trunc := truncateString("x", 0)
		if !trunc {
			t.Fatalf("expected trunc=true, got false")
		}
		if got != "" {
			t.Fatalf("expected empty string, got %q", got)
		}
	})
}

func TestParseZScanPairs_ScoreEdgeCases(t *testing.T) {
	t.Run("empty", func(t *testing.T) {
		items, err := parseZScanPairs(nil)
		if err != nil {
			t.Fatalf("expected nil err, got %v", err)
		}
		if items != nil && len(items) != 0 {
			t.Fatalf("expected empty, got %#v", items)
		}
	})

	t.Run("odd_length", func(t *testing.T) {
		_, err := parseZScanPairs([]string{"a"})
		if err == nil {
			t.Fatalf("expected err, got nil")
		}
	})

	t.Run("invalid_score", func(t *testing.T) {
		_, err := parseZScanPairs([]string{"a", "not-a-number"})
		if err == nil {
			t.Fatalf("expected err, got nil")
		}
	})

	t.Run("non_finite_score_inf", func(t *testing.T) {
		_, err := parseZScanPairs([]string{"a", "inf"})
		if err == nil {
			t.Fatalf("expected err, got nil")
		}
	})

	t.Run("non_finite_score_overflow", func(t *testing.T) {
		// ParseFloat("1e309") returns +Inf with ErrRange on most platforms;
		// we should reject non-finite scores either way.
		_, err := parseZScanPairs([]string{"a", "1e309"})
		if err == nil {
			t.Fatalf("expected err, got nil")
		}
	})

	t.Run("valid_score", func(t *testing.T) {
		items, err := parseZScanPairs([]string{"a", "1.5", "b", "-2"})
		if err != nil {
			t.Fatalf("expected nil err, got %v", err)
		}
		if len(items) != 2 {
			t.Fatalf("expected 2 items, got %d", len(items))
		}
		if items[0].Member != "a" || items[0].Score != 1.5 {
			t.Fatalf("unexpected item0: %#v", items[0])
		}
		if items[1].Member != "b" || items[1].Score != -2 {
			t.Fatalf("unexpected item1: %#v", items[1])
		}
	})
}

