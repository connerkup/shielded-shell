export interface Literal {
  relation: string;
  args: string[];
}

export interface Rule {
  head: Literal;
  body: Literal[];
}

class DatalogFact implements Literal {
  constructor(
    public relation: string,
    public args: string[],
  ) {}

  key(): string {
    return `${this.relation}(${this.args.join(",")})`;
  }
}

export class DatalogEvaluator {
  private factsByKey = new Set<string>();
  private database = new Map<string, DatalogFact[]>();
  private rules: Rule[] = [];

  addFact(relation: string, args: string[]): boolean {
    const fact = new DatalogFact(relation, args);
    const key = fact.key();
    if (this.factsByKey.has(key)) return false;
    this.factsByKey.add(key);
    const bucket = this.database.get(relation) ?? [];
    bucket.push(fact);
    this.database.set(relation, bucket);
    return true;
  }

  addRule(head: Literal, body: Literal[]): void {
    this.rules.push({ head, body });
  }

  private isVariable(term: string): boolean {
    return /^[A-Z]/.test(term);
  }

  private unify(
    literal: Literal,
    fact: Literal,
    sub: Record<string, string>,
  ): Record<string, string> | null {
    if (literal.args.length !== fact.args.length) return null;
    const nextSub = { ...sub };
    for (let i = 0; i < literal.args.length; i++) {
      const term = literal.args[i];
      const val = fact.args[i];
      if (this.isVariable(term)) {
        const existing = nextSub[term];
        if (existing !== undefined && existing !== val) return null;
        nextSub[term] = val;
      } else if (term !== val) {
        return null;
      }
    }
    return nextSub;
  }

  private evaluateBody(
    body: Literal[],
    idx: number,
    currentSub: Record<string, string>,
  ): Record<string, string>[] {
    if (idx === body.length) return [currentSub];
    const literal = body[idx];
    const relationFacts = this.database.get(literal.relation) ?? [];
    const subs: Record<string, string>[] = [];
    for (const fact of relationFacts) {
      const nextSub = this.unify(literal, fact, currentSub);
      if (nextSub) {
        subs.push(...this.evaluateBody(body, idx + 1, nextSub));
      }
    }
    return subs;
  }

  solve(maxIterations = 100): number {
    let iterations = 0;
    let newFactAdded = true;

    while (newFactAdded && iterations < maxIterations) {
      newFactAdded = false;
      iterations += 1;
      const factsToInsert: DatalogFact[] = [];

      for (const rule of this.rules) {
        const substitutions = this.evaluateBody(rule.body, 0, {});
        for (const sub of substitutions) {
          const instantiatedArgs = rule.head.args.map((arg) => {
            if (this.isVariable(arg)) {
              const val = sub[arg];
              if (val === undefined) {
                throw new Error(`Unbound variable ${arg} in rule head`);
              }
              return val;
            }
            return arg;
          });
          const candidate = new DatalogFact(rule.head.relation, instantiatedArgs);
          if (!this.factsByKey.has(candidate.key())) {
            factsToInsert.push(candidate);
          }
        }
      }

      for (const fact of factsToInsert) {
        if (this.addFact(fact.relation, fact.args)) {
          newFactAdded = true;
        }
      }
    }

    return iterations;
  }

  query(relation: string, args: string[]): string[][] {
    const results: string[][] = [];
    const queryLit: Literal = { relation, args };
    const relationFacts = this.database.get(relation) ?? [];
    for (const fact of relationFacts) {
      if (this.unify(queryLit, fact, {})) {
        results.push(fact.args);
      }
    }
    return results;
  }

  hasFact(relation: string, args: string[]): boolean {
    return this.factsByKey.has(new DatalogFact(relation, args).key());
  }
}

export function evaluateApiGatewayPolicy(
  policies: Record<string, string>,
  routes: Record<string, string>,
): { safe: boolean; violations: string[] } {
  const dl = new DatalogEvaluator();
  for (const [route, target] of Object.entries(routes)) {
    dl.addFact("route", [route, target]);
  }
  for (const [route, policy] of Object.entries(policies)) {
    dl.addFact("policy", [route, policy]);
    if (policy === "Public") {
      dl.addFact("is_public", [route]);
    } else {
      dl.addFact("is_secured", [route]);
    }
    if (route.includes("billing") || route.includes("users")) {
      dl.addFact("sensitive_route", [route]);
    }
  }
  dl.addRule(
    { relation: "violation", args: ["Route"] },
    [
      { relation: "sensitive_route", args: ["Route"] },
      { relation: "is_public", args: ["Route"] },
    ],
  );
  dl.solve();
  const violations = dl.query("violation", ["R"]).map((row) => row[0]);
  return { safe: violations.length === 0, violations };
}
