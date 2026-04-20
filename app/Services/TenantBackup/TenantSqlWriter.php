<?php

namespace App\Services\TenantBackup;

use DateTimeInterface;
use Illuminate\Database\Connection;

class TenantSqlWriter
{
    public function __construct(
        protected Connection $connection
    ) {}

    public function quoteValue(mixed $value): string
    {
        if ($value === null) {
            return 'NULL';
        }
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }
        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }
        if ($value instanceof DateTimeInterface) {
            return $this->connection->getPdo()->quote($value->format('Y-m-d H:i:s'));
        }

        return $this->connection->getPdo()->quote((string) $value);
    }

    /**
     * @param  array<int, string>  $columns
     */
    public function insertRowsSql(string $table, array $columns, iterable $rows): string
    {
        $sql = '';
        foreach ($rows as $row) {
            $arr = (array) $row;
            $vals = [];
            foreach ($columns as $col) {
                $vals[] = $this->quoteValue($arr[$col] ?? null);
            }
            $sql .= sprintf(
                "INSERT INTO `%s` (`%s`) VALUES (%s);\n",
                str_replace('`', '``', $table),
                implode('`,`', $columns),
                implode(',', $vals)
            );
        }

        return $sql;
    }
}
