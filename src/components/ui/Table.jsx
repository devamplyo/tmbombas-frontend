import styles from './Table.module.css';

/**
 * Simple table.
 * columns: [{ key, header, render?(row), align? }]
 * rows: array of objects (need to have `id`)
 */
export default function Table({ columns, rows, empty = 'Nenhum registro.', onRowClick }) {
  if (!rows?.length) {
    return <div className={styles.empty}>{empty}</div>;
  }
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || 'left' }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? styles.clickable : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || 'left' }}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
