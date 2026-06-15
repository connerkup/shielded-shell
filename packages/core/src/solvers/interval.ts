export class Interval {
  readonly min: number;
  readonly max: number;

  constructor(min: number, max: number) {
    if (min > max) {
      throw new Error(`Invalid interval bounds: [${min}, ${max}]`);
    }
    this.min = min;
    this.max = max;
  }

  static from(value: number | [number, number] | Interval): Interval {
    if (value instanceof Interval) return value;
    if (Array.isArray(value)) return new Interval(value[0], value[1]);
    return new Interval(value, value);
  }

  add(other: number | [number, number] | Interval): Interval {
    const o = Interval.from(other);
    return new Interval(this.min + o.min, this.max + o.max);
  }

  subtract(other: number | [number, number] | Interval): Interval {
    const o = Interval.from(other);
    return new Interval(this.min - o.max, this.max - o.min);
  }

  isLessThan(value: number): boolean {
    return this.max < value;
  }

  isPossiblyLessThan(value: number): boolean {
    return this.min < value;
  }

  toString(): string {
    return `[${this.min}, ${this.max}]`;
  }
}

export interface Transfer {
  from: string;
  to: string;
  amount: number | [number, number];
}

export interface LedgerSafetyResult {
  safe: boolean;
  guaranteedUnsafe: boolean;
  violatingStep: number;
  violatingAccount: string;
  violatingBalance: Interval;
  finalBalances: Record<string, Interval>;
}

export function analyzeLedgerSafety(
  startingBalances: Record<string, number | [number, number]>,
  transfers: Transfer[],
): LedgerSafetyResult {
  const balances: Record<string, Interval> = {};
  for (const [name, value] of Object.entries(startingBalances)) {
    balances[name] = Interval.from(value);
  }

  for (let idx = 0; idx < transfers.length; idx++) {
    const tx = transfers[idx];
    const amount = Interval.from(tx.amount);
    const fromBal = balances[tx.from] ?? new Interval(0, 0);
    const toBal = balances[tx.to] ?? new Interval(0, 0);
    const newFrom = fromBal.subtract(amount);
    const newTo = toBal.add(amount);

    balances[tx.from] = newFrom;
    balances[tx.to] = newTo;

    if (newFrom.isPossiblyLessThan(0)) {
      return {
        safe: false,
        guaranteedUnsafe: newFrom.isLessThan(0),
        violatingStep: idx + 1,
        violatingAccount: tx.from,
        violatingBalance: newFrom,
        finalBalances: balances,
      };
    }
  }

  return {
    safe: true,
    guaranteedUnsafe: false,
    violatingStep: 0,
    violatingAccount: "",
    violatingBalance: new Interval(0, 0),
    finalBalances: balances,
  };
}
