// Spostamento su/giù di un elemento in una lista ordinata per "position".
// Scambia la posizione con il vicino; se le posizioni sono uguali o con buchi, prima le rinumera.
type Row = { id: number; position: number };

export async function moveItem(
  list: () => Promise<Row[]>,
  setPosition: (id: number, position: number) => Promise<unknown>,
  id: number,
  direction: "up" | "down",
): Promise<void> {
  const rows = await list();
  const index = rows.findIndex((r) => r.id === id);
  const other = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || other < 0 || other >= rows.length) return;
  const reordered = [...rows];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(other, 0, moved!);
  for (const [position, row] of reordered.entries()) {
    if (row.position !== position) await setPosition(row.id, position);
  }
}
