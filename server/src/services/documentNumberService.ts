import { prisma } from '../config/db';

export type DocumentPrefix = 'INV' | 'QUO';

/**
 * Generates sequential document numbers like INV-2026-0001 / QUO-2026-0001.
 *
 * Uses an atomic counter per prefix+year (DocumentCounter) instead of
 * `count() + 1`, which produced duplicates after deletions or when two
 * documents were created at the same time.
 */
export class DocumentNumberService {
  private static async numberExists(prefix: DocumentPrefix, value: string): Promise<boolean> {
    if (prefix === 'INV') {
      return (await prisma.invoice.count({ where: { invoiceNumber: value } })) > 0;
    }
    return (await prisma.quotation.count({ where: { quotationNumber: value } })) > 0;
  }

  // Highest sequence already used for this prefix/year, so a new counter continues after existing documents.
  private static async highestExisting(prefix: DocumentPrefix, year: number): Promise<number> {
    const base = `${prefix}-${year}-`;
    const numbers =
      prefix === 'INV'
        ? (await prisma.invoice.findMany({ where: { invoiceNumber: { startsWith: base } }, select: { invoiceNumber: true } })).map((r) => r.invoiceNumber)
        : (await prisma.quotation.findMany({ where: { quotationNumber: { startsWith: base } }, select: { quotationNumber: true } })).map((r) => r.quotationNumber);

    return numbers.reduce((max, n) => {
      const seq = parseInt(n.slice(base.length), 10);
      return Number.isFinite(seq) && seq > max ? seq : max;
    }, 0);
  }

  private static async ensureCounter(key: string, prefix: DocumentPrefix, year: number): Promise<void> {
    const existing = await prisma.documentCounter.findUnique({ where: { key } });
    if (existing) return;

    const start = await this.highestExisting(prefix, year);
    try {
      await prisma.documentCounter.create({ data: { key, seq: start } });
    } catch (err: any) {
      // Another request created it first — that's fine.
      if (err?.code !== 'P2002') throw err;
    }
  }

  private static async increment(key: string): Promise<number> {
    const result: any = await prisma.$runCommandRaw({
      findAndModify: 'DocumentCounter',
      query: { key },
      update: { $inc: { seq: 1 } },
      new: true,
    });
    const seq = Number(result?.value?.seq);
    if (!Number.isFinite(seq)) {
      throw new Error(`Document counter ${key} could not be incremented`);
    }
    return seq;
  }

  public static async next(prefix: DocumentPrefix, date: Date = new Date()): Promise<string> {
    const year = date.getFullYear();
    const key = `${prefix}-${year}`;
    await this.ensureCounter(key, prefix, year);

    // Skip any number that already exists (e.g. created manually or by an older version).
    for (let attempt = 0; attempt < 20; attempt++) {
      const seq = await this.increment(key);
      const value = `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
      if (!(await this.numberExists(prefix, value))) return value;
    }
    throw new Error(`Could not allocate a unique ${prefix} number`);
  }
}
