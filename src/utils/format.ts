import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

/**
 * Returns current date in YYYY-MM-DD format based on America/Sao_Paulo timezone
 */
export function getLocalDateString(date: Date = new Date()): string {
    return format(date, "yyyy-MM-dd");
}

/**
 * Returns current date and time formatted for Brazil
 */
export function formatDateTime(date: Date | string): string {
    if (!date) return "-";
    let d: Date;
    if (typeof date === "string") {
        // If it's just a date YYYY-MM-DD, add time to avoid timezone shift
        d = date.includes("T") ? new Date(date) : new Date(date + "T12:00:00");
    } else {
        d = date;
    }
    return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/**
 * Returns date formatted for Brazil
 */
export function formatDate(date: Date | string): string {
    if (!date) return "-";
    let d: Date;
    if (typeof date === "string") {
        // If it's just a date YYYY-MM-DD, add time to avoid timezone shift
        d = date.includes("T") ? new Date(date) : new Date(date + "T12:00:00");
    } else {
        d = date;
    }
    return format(d, "dd/MM/yyyy", { locale: ptBR });
}
