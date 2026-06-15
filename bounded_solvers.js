/**
 * Bounded Solvers for Multi-Agent Safety and Validation Tiers.
 * Implements:
 * 1. Linear-Time Interval Arithmetic Solver (Alternative B)
 * 2. Polynomial-Time Horn-Clause Datalog Solver (Alternative A)
 *
 * Mathematically guarantees that constraint checks never enter exponential-time
 * or undecidable paths, preventing denial-of-service or hang vulnerabilities.
 */

// ==========================================
// 1. INTERVAL ARITHMETIC SOLVER (Alternative B)
// ==========================================

class Interval {
  constructor(min = -Infinity, max = Infinity) {
    this.min = Number(min);
    this.max = Number(max);
    if (this.min > this.max) {
      throw new Error(`Invalid interval bounds: [${min}, ${max}]`);
    }
  }

  static from(val) {
    if (val instanceof Interval) return val;
    if (Array.isArray(val)) return new Interval(val[0], val[1]);
    return new Interval(val, val);
  }

  add(other) {
    const o = Interval.from(other);
    return new Interval(this.min + o.min, this.max + o.max);
  }

  subtract(other) {
    const o = Interval.from(other);
    return new Interval(this.min - o.max, this.max - o.min);
  }

  multiply(other) {
    const o = Interval.from(other);
    const p1 = this.min * o.min;
    const p2 = this.min * o.max;
    const p3 = this.max * o.min;
    const p4 = this.max * o.max;
    return new Interval(
      Math.min(p1, p2, p3, p4),
      Math.max(p1, p2, p3, p4)
    );
  }

  intersect(other) {
    const o = Interval.from(other);
    const newMin = Math.max(this.min, o.min);
    const newMax = Math.min(this.max, o.max);
    if (newMin > newMax) return null; // Empty intersection
    return new Interval(newMin, newMax);
  }

  union(other) {
    const o = Interval.from(other);
    return new Interval(Math.min(this.min, o.min), Math.max(this.max, o.max));
  }

  contains(val) {
    return val >= this.min && val <= this.max;
  }

  isLessThan(val) {
    return this.max < val;
  }

  isPossiblyLessThan(val) {
    return this.min < val;
  }

  toString() {
    return `[${this.min}, ${this.max}]`;
  }
}

/**
 * Propagates transactions sequentially to verify ledger invariant safety.
 * Returns true if balances are guaranteed to stay non-negative.
 *
 * @param {Object} startingBalances Map of names to intervals/values
 * @param {Array} transfers List of {from, to, amount} objects where amount can be interval or value
 * @returns {Object} { safe, guaranteedUnsafe, balances }
 */
function analyzeLedgerSafety(startingBalances, transfers) {
  const balances = {};
  for (const [name, val] of Object.entries(startingBalances)) {
    balances[name] = Interval.from(val);
  }

  let step = 0;
  for (const tx of transfers) {
    const amount = Interval.from(tx.amount || 0);
    const fromBal = balances[tx.from] || new Interval(0, 0);
    const toBal = balances[tx.to] || new Interval(0, 0);

    // Apply the transaction rules
    balances[tx.from] = fromBal.subtract(amount);
    balances[tx.to] = toBal.add(amount);
    step++;

    // Safety Invariant: check if the 'from' account balance could possibly drop below 0
    if (balances[tx.from].isPossiblyLessThan(0)) {
      const isGuaranteed = balances[tx.from].isLessThan(0);
      return {
        safe: false,
        guaranteedUnsafe: isGuaranteed,
        violatingStep: step,
        violatingAccount: tx.from,
        violatingBalance: balances[tx.from].toString(),
        balances
      };
    }
  }

  return {
    safe: true,
    guaranteedUnsafe: false,
    balances
  };
}

// ==========================================
// 2. HORN-CLAUSE DATALOG SOLVER (Alternative A)
// ==========================================

class DatalogFact {
  constructor(relation, args) {
    this.relation = String(relation);
    this.args = args.map(String);
  }

  key() {
    return `${this.relation}(${this.args.join(',')})`;
  }

  toString() {
    return this.key();
  }
}

class DatalogRule {
  /**
   * @param {Object} head { relation: string, args: string[] }
   * @param {Array} body array of { relation: string, args: string[] }
   */
  constructor(head, body) {
    this.head = head;
    this.body = body;
  }
}

class DatalogEvaluator {
  constructor() {
    // Map of relationName -> Set of DatalogFact string keys
    this.factsByKey = new Set();
    // Map of relationName -> array of DatalogFact objects
    this.database = new Map();
    this.rules = [];
  }

  addFact(relation, args) {
    const fact = new DatalogFact(relation, args);
    const key = fact.key();
    if (!this.factsByKey.has(key)) {
      this.factsByKey.add(key);
      if (!this.database.has(relation)) {
        this.database.set(relation, []);
      }
      this.database.get(relation).push(fact);
      return true;
    }
    return false;
  }

  addRule(head, body) {
    this.rules.push(new DatalogRule(head, body));
  }

  isVariable(term) {
    return typeof term === 'string' && term.length > 0 && term[0] === term[0].toUpperCase() && term[0] !== term[0].toLowerCase();
  }

  /**
   * Unifies a literal against a concrete fact given an existing variable substitution map.
   * Returns a new substitution map if unification succeeds, or null if it fails.
   */
  unify(literal, fact, sub) {
    if (literal.args.length !== fact.args.length) return null;
    const nextSub = { ...sub };

    for (let i = 0; i < literal.args.length; i++) {
      const term = literal.args[i];
      const val = fact.args[i];

      if (this.isVariable(term)) {
        if (term in nextSub) {
          if (nextSub[term] !== val) return null;
        } else {
          nextSub[term] = val;
        }
      } else {
        if (term !== val) return null;
      }
    }
    return nextSub;
  }

  /**
   * Evaluates a rule body recursively, generating all valid substitution mappings.
   */
  evaluateBody(body, idx = 0, currentSub = {}) {
    if (idx === body.length) {
      return [currentSub];
    }

    const literal = body[idx];
    const relationFacts = this.database.get(literal.relation) || [];
    let subs = [];

    for (const fact of relationFacts) {
      const nextSub = this.unify(literal, fact, currentSub);
      if (nextSub) {
        subs = subs.concat(this.evaluateBody(body, idx + 1, nextSub));
      }
    }

    return subs;
  }

  /**
   * Evaluates rules bottom-up using fixed-point iteration.
   * Guaranteed to terminate in polynomial time.
   * Max iterations parameter protects against system limits.
   *
   * @param {number} maxIterations safety cap to prevent CPU exhaustion
   * @returns {number} number of iterations run
   */
  solve(maxIterations = 100) {
    let iterations = 0;
    let newFactAdded = true;

    while (newFactAdded && iterations < maxIterations) {
      newFactAdded = false;
      iterations++;
      
      const factsToInsert = [];

      for (const rule of this.rules) {
        const substitutions = this.evaluateBody(rule.body);

        for (const sub of substitutions) {
          // Instantiate the head literal using the substitutions
          const instantiatedArgs = rule.head.args.map(arg => {
            if (this.isVariable(arg)) {
              if (!(arg in sub)) {
                throw new Error(`Unbound variable ${arg} in rule head for relation ${rule.head.relation}`);
              }
              return sub[arg];
            }
            return arg;
          });

          const candidateFact = new DatalogFact(rule.head.relation, instantiatedArgs);
          if (!this.factsByKey.has(candidateFact.key())) {
            factsToInsert.push(candidateFact);
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

  query(relation, args) {
    const results = [];
    const relationFacts = this.database.get(relation) || [];

    for (const fact of relationFacts) {
      const sub = this.unify({ relation, args }, fact, {});
      if (sub) {
        results.push(fact.args);
      }
    }
    return results;
  }

  hasFact(relation, args) {
    const fact = new DatalogFact(relation, args);
    return this.factsByKey.has(fact.key());
  }
}

module.exports = {
  Interval,
  analyzeLedgerSafety,
  DatalogFact,
  DatalogRule,
  DatalogEvaluator
};
