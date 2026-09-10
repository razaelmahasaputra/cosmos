export function formatRupiah(n: number): string {
  return (
    "Rp" +
    Math.round(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}
