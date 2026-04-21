package mysqlx

import (
	"context"
	"database/sql"
)

type Database struct {
	Name string `json:"name"`
}

type Table struct {
	Name string `json:"name"`
}

type TableColumn struct {
	Name            string  `json:"name"`
	DataType        string  `json:"dataType"`
	ColumnType      string  `json:"columnType"`
	IsNullable      bool    `json:"isNullable"`
	DefaultValue    *string `json:"defaultValue,omitempty"`
	Extra           string  `json:"extra,omitempty"`
	ColumnKey       string  `json:"columnKey,omitempty"`
	OrdinalPosition int     `json:"ordinalPosition"`
	Comment         string  `json:"comment,omitempty"`
}

type TableIndex struct {
	Name       string  `json:"name"`
	NonUnique  bool    `json:"nonUnique"`
	SeqInIndex int     `json:"seqInIndex"`
	ColumnName string  `json:"columnName"`
	Collation  *string `json:"collation,omitempty"`
	Nullable   *bool   `json:"nullable,omitempty"`
	IndexType  string  `json:"indexType,omitempty"`
	Comment    *string `json:"comment,omitempty"`
}

func ListDatabases(ctx context.Context, db *sql.DB) ([]Database, error) {
	rows, err := db.QueryContext(ctx, `
SELECT schema_name
FROM information_schema.schemata
ORDER BY schema_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Database
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, Database{Name: name})
	}
	return out, rows.Err()
}

func ListTables(ctx context.Context, db *sql.DB, database string) ([]Table, error) {
	rows, err := db.QueryContext(ctx, `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = ?
ORDER BY table_name`, database)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Table
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, Table{Name: name})
	}
	return out, rows.Err()
}

func GetTableColumns(ctx context.Context, db *sql.DB, database, table string) ([]TableColumn, error) {
	rows, err := db.QueryContext(ctx, `
SELECT
  column_name,
  data_type,
  column_type,
  is_nullable,
  column_default,
  extra,
  column_key,
  ordinal_position,
  column_comment
FROM information_schema.columns
WHERE table_schema = ? AND table_name = ?
ORDER BY ordinal_position`, database, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TableColumn
	for rows.Next() {
		var (
			name       string
			dataType   string
			columnType string
			isNullable string
			defVal     sql.NullString
			extra      sql.NullString
			columnKey  sql.NullString
			ordinal    int
			comment    sql.NullString
		)
		if err := rows.Scan(
			&name,
			&dataType,
			&columnType,
			&isNullable,
			&defVal,
			&extra,
			&columnKey,
			&ordinal,
			&comment,
		); err != nil {
			return nil, err
		}
		var defPtr *string
		if defVal.Valid {
			v := defVal.String
			defPtr = &v
		}

		out = append(out, TableColumn{
			Name:            name,
			DataType:        dataType,
			ColumnType:      columnType,
			IsNullable:      isNullable == "YES",
			DefaultValue:    defPtr,
			Extra:           extra.String,
			ColumnKey:       columnKey.String,
			OrdinalPosition: ordinal,
			Comment:         comment.String,
		})
	}
	return out, rows.Err()
}

func GetTableIndexes(ctx context.Context, db *sql.DB, database, table string) ([]TableIndex, error) {
	rows, err := db.QueryContext(ctx, `
SELECT
  index_name,
  non_unique,
  seq_in_index,
  column_name,
  collation,
  nullable,
  index_type,
  index_comment
FROM information_schema.statistics
WHERE table_schema = ? AND table_name = ?
ORDER BY index_name, seq_in_index`, database, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TableIndex
	for rows.Next() {
		var (
			indexName string
			nonUnique int
			seq       int
			column    string
			collation sql.NullString
			nullable  sql.NullString
			indexType sql.NullString
			comment   sql.NullString
		)
		if err := rows.Scan(
			&indexName,
			&nonUnique,
			&seq,
			&column,
			&collation,
			&nullable,
			&indexType,
			&comment,
		); err != nil {
			return nil, err
		}

		var collationPtr *string
		if collation.Valid {
			v := collation.String
			collationPtr = &v
		}

		var nullablePtr *bool
		if nullable.Valid {
			v := nullable.String == "YES"
			nullablePtr = &v
		}

		var commentPtr *string
		if comment.Valid {
			v := comment.String
			commentPtr = &v
		}

		out = append(out, TableIndex{
			Name:       indexName,
			NonUnique:  nonUnique == 1,
			SeqInIndex: seq,
			ColumnName: column,
			Collation:  collationPtr,
			Nullable:   nullablePtr,
			IndexType:  indexType.String,
			Comment:    commentPtr,
		})
	}
	return out, rows.Err()
}
