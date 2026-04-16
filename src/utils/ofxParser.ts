export interface OFXTransaction {
    id: string;
    date: Date;
    amount: number;
    description: string;
    type: "DEBIT" | "CREDIT";
}

export function parseOFX(content: string): OFXTransaction[] {
    const transactions: OFXTransaction[] = [];

    // Simple regex based parsing for standard OFX banking export
    // Looks for <STMTTRN> blocks
    const transactionBlocks = content.split('<STMTTRN>');

    // Skip the header (first block)
    for (let i = 1; i < transactionBlocks.length; i++) {
        const block = transactionBlocks[i];

        // Extract fields using Regex
        const fitidMatch = block.match(/<FITID>(.*?)[\r\n<]/);
        const dtpostedMatch = block.match(/<DTPOSTED>(.*?)[\r\n<]/);
        const trnamtMatch = block.match(/<TRNAMT>(.*?)[\r\n<]/);
        const memoMatch = block.match(/<MEMO>(.*?)[\r\n<]/);

        if (fitidMatch && dtpostedMatch && trnamtMatch) {
            const id = fitidMatch[1].trim();
            const rawDate = dtpostedMatch[1].trim(); // Format: YYYYMMDDHHMMSS or YYYYMMDD
            const amount = parseFloat(trnamtMatch[1].trim());
            const description = memoMatch ? memoMatch[1].trim() : "Sem descrição";

            // Parse Date
            const year = parseInt(rawDate.substring(0, 4));
            const month = parseInt(rawDate.substring(4, 6)) - 1;
            const day = parseInt(rawDate.substring(6, 8));
            const date = new Date(year, month, day);

            transactions.push({
                id,
                date,
                amount,
                description,
                type: amount < 0 ? "DEBIT" : "CREDIT"
            });
        }
    }

    return transactions;
}
