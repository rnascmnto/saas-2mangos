// lib/fatura.ts
//
// Fonte ÚNICA da verdade para calcular em qual mês/ano (competência)
// um lançamento deve aparecer nas telas de Cartões, Lançamentos e Dashboard.
//
// Antes, cada tela tinha a sua própria cópia dessa lógica. A tela de
// Cartões e a de Lançamentos calculavam a "competência da fatura"
// (baseada no fechamento/vencimento do cartão), mas a Dashboard usava
// direto o mês da data da compra. Resultado: o mesmo lançamento podia
// cair em meses diferentes dependendo da tela. Agora as três telas
// importam e usam exatamente esta função.

export interface FaturaCategoria {
  is_credit_card?: boolean | null;
  closing_date?: number | null;
  due_date?: number | null;
}

export interface Competencia {
  year: number;
  month: number; // 1-12
}

/**
 * Calcula a competência (mês/ano) de um lançamento.
 *
 * - Categorias normais: usa o mês/ano da própria data do lançamento.
 * - Categorias de cartão de crédito: usa a data de fechamento e de
 *   vencimento da fatura para "empurrar" a compra para o mês correto
 *   da fatura, exatamente como já era feito nas telas de Cartões e
 *   Lançamentos.
 */
export function getCompetencia(
  date: string,
  categoria?: FaturaCategoria | null
): Competencia {
  const d = new Date(date + "T12:00:00Z");
  let month = d.getMonth(); // 0-11
  let year = d.getFullYear();

  if (categoria?.is_credit_card) {
    const closingDay = categoria.closing_date;
    const dueDay = categoria.due_date;

    if (closingDay && dueDay) {
      if (d.getDate() >= closingDay) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      if (dueDay < closingDay) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
    }
  }

  return { year, month: month + 1 };
}

/** Retorna o mês da competência já formatado com 2 dígitos ("01".."12"). */
export function competenciaMonthStr(c: Competencia): string {
  return String(c.month).padStart(2, "0");
}

/** Retorna o ano da competência como string (ex: "2026"). */
export function competenciaYearStr(c: Competencia): string {
  return c.year.toString();
}

/**
 * Testa se um lançamento pertence ao mês/ano selecionados nos filtros das
 * telas (que usam os valores "Todos os Meses" / "Todos os Anos" como coringa).
 */
export function matchesCompetencia(
  date: string,
  categoria: FaturaCategoria | null | undefined,
  selectedMonth: string,
  selectedYear: string,
  monthMap: { [key: string]: string }
): boolean {
  const c = getCompetencia(date, categoria);
  const matchesYear =
    selectedYear === "Todos os Anos" || competenciaYearStr(c) === selectedYear;
  const matchesMonth =
    selectedMonth === "Todos os Meses" ||
    competenciaMonthStr(c) === monthMap[selectedMonth];
  return matchesYear && matchesMonth;
}