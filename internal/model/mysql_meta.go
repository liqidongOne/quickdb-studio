package model

// MySQLTableMetaResp is the MySQL table metadata response.
type MySQLTableMetaResp struct {
	Database string              `json:"database"`
	Table    string              `json:"table"`
	Columns  []MySQLTableColumn `json:"columns"`
	Indexes  []MySQLTableIndex  `json:"indexes"`
}

// MySQLTableColumn is a JSON-friendly table column metadata struct.
// It intentionally duplicates mysqlx.TableColumn to avoid import cycles.
type MySQLTableColumn struct {
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

// MySQLTableIndex is a JSON-friendly table index metadata struct.
// It intentionally duplicates mysqlx.TableIndex to avoid import cycles.
type MySQLTableIndex struct {
	Name       string  `json:"name"`
	NonUnique  bool    `json:"nonUnique"`
	SeqInIndex int     `json:"seqInIndex"`
	ColumnName string  `json:"columnName"`
	Collation  *string `json:"collation,omitempty"`
	Nullable   *bool   `json:"nullable,omitempty"`
	IndexType  string  `json:"indexType,omitempty"`
	Comment    *string `json:"comment,omitempty"`
}
