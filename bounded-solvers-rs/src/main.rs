use serde::{Deserialize, Deserializer, Serialize};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::ops::{Add, Sub};
use std::path::Path;

// ==========================================================
// 1. INTERVAL ARITHMETIC SOLVER (Alternative B)
// ==========================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Interval {
    pub min: f64,
    pub max: f64,
}

impl Interval {
    pub fn new(min: f64, max: f64) -> Self {
        if min > max {
            panic!("Invalid interval bounds: [{}, {}]", min, max);
        }
        Interval { min, max }
    }

    pub fn contains(&self, val: f64) -> bool {
        val >= self.min && val <= self.max
    }

    pub fn is_less_than(&self, val: f64) -> bool {
        self.max < val
    }

    pub fn is_possibly_less_than(&self, val: f64) -> bool {
        self.min < val
    }
}

// Custom deserialization to support both single floats (e.g. 250) and arrays (e.g. [100, 150])
impl<'de> Deserialize<'de> for Interval {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum IntervalRaw {
            Single(f64),
            Range(f64, f64),
        }

        match IntervalRaw::deserialize(deserializer)? {
            IntervalRaw::Single(val) => Ok(Interval::new(val, val)),
            IntervalRaw::Range(min, max) => Ok(Interval::new(min, max)),
        }
    }
}

impl Add for Interval {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        Interval::new(self.min + other.min, self.max + other.max)
    }
}

impl Sub for Interval {
    type Output = Self;

    fn sub(self, other: Self) -> Self {
        Interval::new(self.min - other.max, self.max - other.min)
    }
}

#[derive(Debug, Deserialize)]
pub struct Transfer {
    pub from: String,
    pub to: String,
    pub amount: Interval,
}

pub struct LedgerSafetyResult {
    pub safe: bool,
    pub guaranteed_unsafe: bool,
    pub violating_step: usize,
    pub violating_account: String,
    pub violating_balance: Interval,
    pub final_balances: HashMap<String, Interval>,
}

pub fn analyze_ledger_safety(
    starting_balances: &HashMap<String, Interval>,
    transfers: &[Transfer],
) -> LedgerSafetyResult {
    let mut balances = starting_balances.clone();

    for (idx, tx) in transfers.iter().enumerate() {
        let from_bal = *balances.get(&tx.from).unwrap_or(&Interval::new(0.0, 0.0));
        let to_bal = *balances.get(&tx.to).unwrap_or(&Interval::new(0.0, 0.0));

        let new_from = from_bal - tx.amount;
        let new_to = to_bal + tx.amount;

        balances.insert(tx.from.clone(), new_from);
        balances.insert(tx.to.clone(), new_to);

        if new_from.is_possibly_less_than(0.0) {
            return LedgerSafetyResult {
                safe: false,
                guaranteed_unsafe: new_from.is_less_than(0.0),
                violating_step: idx + 1,
                violating_account: tx.from.clone(),
                violating_balance: new_from,
                final_balances: balances,
            };
        }
    }

    LedgerSafetyResult {
        safe: true,
        guaranteed_unsafe: false,
        violating_step: 0,
        violating_account: String::new(),
        violating_balance: Interval::new(0.0, 0.0),
        final_balances: balances,
    }
}

// ==========================================================
// 2. HORN-CLAUSE DATALOG SOLVER (Alternative A)
// ==========================================================

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Literal {
    pub relation: String,
    pub args: Vec<String>,
}

impl Literal {
    pub fn new(relation: &str, args: &[&str]) -> Self {
        Literal {
            relation: relation.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
        }
    }

    pub fn key(&self) -> String {
        format!("{}({})", self.relation, self.args.join(","))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub head: Literal,
    pub body: Vec<Literal>,
}

pub struct DatalogEvaluator {
    pub facts_by_key: HashSet<String>,
    pub database: HashMap<String, Vec<Literal>>,
    pub rules: Vec<Rule>,
}

impl DatalogEvaluator {
    pub fn new() -> Self {
        DatalogEvaluator {
            facts_by_key: HashSet::new(),
            database: HashMap::new(),
            rules: Vec::new(),
        }
    }

    pub fn add_fact(&mut self, relation: &str, args: &[&str]) -> bool {
        let fact = Literal::new(relation, args);
        let key = fact.key();
        if !self.facts_by_key.contains(&key) {
            self.facts_by_key.insert(key);
            self.database
                .entry(relation.to_string())
                .or_insert_with(Vec::new)
                .push(fact);
            true
        } else {
            false
        }
    }

    pub fn add_rule(&mut self, head: Literal, body: Vec<Literal>) {
        self.rules.push(Rule { head, body });
    }

    fn is_variable(term: &str) -> bool {
        !term.is_empty()
            && term.chars().next().unwrap().is_uppercase()
            && term.chars().next().unwrap().is_alphabetic()
    }

    fn unify(&self, literal: &Literal, fact: &Literal, sub: &HashMap<String, String>) -> Option<HashMap<String, String>> {
        if literal.args.len() != fact.args.len() {
            return Option::None;
        }

        let mut next_sub = sub.clone();
        for (term, val) in literal.args.iter().zip(fact.args.iter()) {
            if Self::is_variable(term) {
                if let Some(existing) = next_sub.get(term) {
                    if existing != val {
                        return Option::None;
                    }
                } else {
                    next_sub.insert(term.clone(), val.clone());
                }
            } else {
                if term != val {
                    return Option::None;
                }
            }
        }
        Some(next_sub)
    }

    fn evaluate_body(&self, body: &[Literal], idx: usize, current_sub: &HashMap<String, String>) -> Vec<HashMap<String, String>> {
        if idx == body.len() {
            return vec![current_sub.clone()];
        }

        let literal = &body[idx];
        let relation_facts = match self.database.get(&literal.relation) {
            Some(f) => f,
            None => return Vec::new(),
        };

        let mut subs = Vec::new();
        for fact in relation_facts {
            if let Some(next_sub) = self.unify(literal, fact, current_sub) {
                subs.extend(self.evaluate_body(body, idx + 1, &next_sub));
            }
        }
        subs
    }

    pub fn solve(&mut self, max_iterations: usize) -> usize {
        let mut iterations = 0;
        let mut new_fact_added = true;

        while new_fact_added && iterations < max_iterations {
            new_fact_added = false;
            iterations += 1;

            let mut facts_to_insert = Vec::new();

            for rule in &self.rules {
                let substitutions = self.evaluate_body(&rule.body, 0, &HashMap::new());

                for sub in substitutions {
                    let mut instantiated_args = Vec::new();
                    for arg in &rule.head.args {
                        if Self::is_variable(arg) {
                            if let Some(val) = sub.get(arg) {
                                instantiated_args.push(val.clone());
                            } else {
                                panic!("Unbound variable {} in rule head", arg);
                            }
                        } else {
                            instantiated_args.push(arg.clone());
                        }
                    }

                    let candidate_fact = Literal {
                        relation: rule.head.relation.clone(),
                        args: instantiated_args,
                    };

                    if !self.facts_by_key.contains(&candidate_fact.key()) {
                        facts_to_insert.push(candidate_fact);
                    }
                }
            }

            for fact in facts_to_insert {
                let args_refs: Vec<&str> = fact.args.iter().map(|s| s.as_str()).collect();
                if self.add_fact(&fact.relation, &args_refs) {
                    new_fact_added = true;
                }
            }
        }

        iterations
    }

    pub fn query(&self, relation: &str, args: &[&str]) -> Vec<Vec<String>> {
        let mut results = Vec::new();
        let query_lit = Literal::new(relation, args);
        let relation_facts = match self.database.get(relation) {
            Some(f) => f,
            None => return Vec::new(),
        };

        for fact in relation_facts {
            if self.unify(&query_lit, fact, &HashMap::new()).is_some() {
                results.push(fact.args.clone());
            }
        }
        results
    }

    pub fn has_fact(&self, relation: &str, args: &[&str]) -> bool {
        let fact = Literal::new(relation, args);
        self.facts_by_key.contains(&fact.key())
    }
}

// ==========================================================
// 3. CLI INTEGRATION & PARSING
// ==========================================================

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: bounded-solvers-rs verify/benchmark --benchmark <name> --auditor-secret <file> --developer-secret <file> [--iterations <count>]");
        std::process::exit(1);
    }

    let command = &args[1];
    if command != "verify" && command != "benchmark" {
        eprintln!("Unknown command: {}", command);
        std::process::exit(1);
    }

    let mut benchmark = String::new();
    let mut auditor_path = String::new();
    let mut developer_path = String::new();
    let mut iterations = 100000;

    let mut i = 2;
    while i < args.len() {
        match args[i].as_str() {
            "--benchmark" => {
                benchmark = args[i + 1].clone();
                i += 2;
            }
            "--auditor-secret" => {
                auditor_path = args[i + 1].clone();
                i += 2;
            }
            "--developer-secret" => {
                developer_path = args[i + 1].clone();
                i += 2;
            }
            "--iterations" => {
                iterations = args[i + 1].parse::<usize>().unwrap_or(100000);
                i += 2;
            }
            _ => {
                eprintln!("Unknown parameter: {}", args[i]);
                std::process::exit(1);
            }
        }
    }

    if benchmark.is_empty() || auditor_path.is_empty() || developer_path.is_empty() {
        eprintln!("Error: Missing required parameters.");
        std::process::exit(1);
    }

    if command == "benchmark" {
        println!("[Rust Solver] Starting benchmark for '{}' ({} iterations)...", benchmark, iterations);
        if benchmark == "02_ledger_consensus" || benchmark == "06_poison_task" {
            let auditor_data = fs::read_to_string(&auditor_path).unwrap();
            let developer_data = fs::read_to_string(&developer_path).unwrap();
            let starting_balances: HashMap<String, Interval> = parse_nth_braced_json(&auditor_data, 0);
            let transfers: Vec<Transfer> = parse_nth_bracketed_json(&developer_data, 0);

            let start = std::time::Instant::now();
            for _ in 0..iterations {
                let _result = analyze_ledger_safety(&starting_balances, &transfers);
            }
            let duration = start.elapsed();
            println!(
                "[Rust Solver] Completed in {:?}. Avg time per run: {:?}",
                duration,
                duration / (iterations as u32)
            );
        } else if benchmark == "04_api_gateway" {
            let auditor_data = fs::read_to_string(&auditor_path).unwrap();
            let developer_data = fs::read_to_string(&developer_path).unwrap();
            let policies: HashMap<String, String> = parse_nth_braced_json(&auditor_data, 0);
            let paths: HashMap<String, String> = parse_nth_braced_json(&developer_data, 0);

            let start = std::time::Instant::now();
            for _ in 0..iterations {
                let mut dl = DatalogEvaluator::new();
                for (route, target) in &paths {
                    dl.add_fact("route", &[route, target]);
                }
                for (route, policy) in &policies {
                    dl.add_fact("policy", &[route, policy]);
                    if policy == "Public" {
                        dl.add_fact("is_public", &[route]);
                    } else {
                        dl.add_fact("is_secured", &[route]);
                    }
                    if route.contains("billing") || route.contains("users") {
                        dl.add_fact("sensitive_route", &[route]);
                    }
                }
                let rule_head = Literal::new("violation", &["Route"]);
                let rule_body = vec![
                    Literal::new("sensitive_route", &["Route"]),
                    Literal::new("is_public", &["Route"]),
                ];
                dl.add_rule(rule_head, rule_body);
                dl.solve(100);
                let _violations = dl.query("violation", &["R"]);
            }
            let duration = start.elapsed();
            println!(
                "[Rust Solver] Completed in {:?}. Avg time per run: {:?}",
                duration,
                duration / (iterations as u32)
            );
        }
        std::process::exit(0);
    }

    println!("[Rust Solver] Running type-safe analysis for benchmark: {}", benchmark);


    if benchmark == "02_ledger_consensus" || benchmark == "06_poison_task" {
        let auditor_data = fs::read_to_string(&auditor_path)
            .unwrap_or_else(|_| panic!("Failed to read {}", auditor_path));
        let developer_data = fs::read_to_string(&developer_path)
            .unwrap_or_else(|_| panic!("Failed to read {}", developer_path));

        // Find brace matches for JSON in auditor data
        let starting_balances: HashMap<String, Interval> = parse_nth_braced_json(&auditor_data, 0);
        // Find bracket match for JSON in developer data
        let transfers: Vec<Transfer> = parse_nth_bracketed_json(&developer_data, 0);

        let result = analyze_ledger_safety(&starting_balances, &transfers);
        println!(
            "[Rust Solver] Safety analysis: safe={}, guaranteed_unsafe={}",
            result.safe, result.guaranteed_unsafe
        );

        if !result.safe {
            println!(
                "[Rust Solver] ⚠️ Ledger Safety Warning: Account '{}' drops to [{}, {}] at step {}",
                result.violating_account,
                result.violating_balance.min,
                result.violating_balance.max,
                result.violating_step
            );
            if benchmark == "06_poison_task" {
                println!("[Rust Solver] ✅ Poison task successfully detected statically!");
                std::process::exit(0);
            } else {
                eprintln!("[Rust Solver Error] Static ledger check failed!");
                std::process::exit(2);
            }
        } else {
            println!("[Rust Solver] ✅ Ledger safety verified statically in linear time.");
            std::process::exit(0);
        }
    } else if benchmark == "04_api_gateway" {
        let auditor_data = fs::read_to_string(&auditor_path)
            .unwrap_or_else(|_| panic!("Failed to read {}", auditor_path));
        let developer_data = fs::read_to_string(&developer_path)
            .unwrap_or_else(|_| panic!("Failed to read {}", developer_path));

        let policies: HashMap<String, String> = parse_nth_braced_json(&auditor_data, 0);
        let paths: HashMap<String, String> = parse_nth_braced_json(&developer_data, 0);

        let mut dl = DatalogEvaluator::new();

        for (route, target) in &paths {
            dl.add_fact("route", &[route, target]);
        }
        for (route, policy) in &policies {
            dl.add_fact("policy", &[route, policy]);
            if policy == "Public" {
                dl.add_fact("is_public", &[route]);
            } else {
                dl.add_fact("is_secured", &[route]);
            }
            if route.contains("billing") || route.contains("users") {
                dl.add_fact("sensitive_route", &[route]);
            }
        }

        // Rule: violation(Route) :- sensitive_route(Route), is_public(Route)
        let rule_head = Literal::new("violation", &["Route"]);
        let rule_body = vec![
            Literal::new("sensitive_route", &["Route"]),
            Literal::new("is_public", &["Route"]),
        ];
        dl.add_rule(rule_head, rule_body);

        dl.solve(100);

        let violations = dl.query("violation", &["R"]);
        if !violations.is_empty() {
            eprintln!(
                "[Rust Solver] ⚠️ Security policy violation detected: sensitive route '{}' is marked Public",
                violations[0][0]
            );
            std::process::exit(3);
        } else {
            println!("[Rust Solver] ✅ API Gateway routing policies verified statically in polynomial time.");
            std::process::exit(0);
        }
    } else {
        println!("[Rust Solver] Benchmark '{}' does not require symbolic static solvers. Bypassing.", benchmark);
        std::process::exit(0);
    }
}

// Helpers for block-based JSON extraction in Rust
fn parse_nth_braced_json<T: serde::de::DeserializeOwned>(text: &str, n: usize) -> T {
    let blocks = find_all_braced_blocks(text);
    if n >= blocks.len() {
        panic!("Requested braced block index {} out of bounds (found {})", n, blocks.len());
    }
    serde_json::from_str(blocks[n]).unwrap_or_else(|err| {
        panic!("Failed to parse braced JSON block: {} inside text:\n{}", err, blocks[n])
    })
}

fn parse_nth_bracketed_json<T: serde::de::DeserializeOwned>(text: &str, n: usize) -> T {
    let blocks = find_all_bracketed_blocks(text);
    if n >= blocks.len() {
        panic!("Requested bracketed block index {} out of bounds (found {})", n, blocks.len());
    }
    serde_json::from_str(blocks[n]).unwrap_or_else(|err| {
        panic!("Failed to parse bracketed JSON block: {} inside text:\n{}", err, blocks[n])
    })
}

fn find_all_braced_blocks(text: &str) -> Vec<&str> {
    let mut results = Vec::new();
    let mut start_idx = None;
    let mut brace_count = 0;
    
    for (idx, ch) in text.char_indices() {
        if ch == '{' {
            if brace_count == 0 {
                start_idx = Some(idx);
            }
            brace_count += 1;
        } else if ch == '}' {
            if brace_count > 0 {
                brace_count -= 1;
                if brace_count == 0 {
                    if let Some(start) = start_idx {
                        results.push(&text[start..=idx]);
                        start_idx = None;
                    }
                }
            }
        }
    }
    results
}

fn find_all_bracketed_blocks(text: &str) -> Vec<&str> {
    let mut results = Vec::new();
    let mut start_idx = None;
    let mut bracket_count = 0;
    
    for (idx, ch) in text.char_indices() {
        if ch == '[' {
            if bracket_count == 0 {
                start_idx = Some(idx);
            }
            bracket_count += 1;
        } else if ch == ']' {
            if bracket_count > 0 {
                bracket_count -= 1;
                if bracket_count == 0 {
                    if let Some(start) = start_idx {
                        results.push(&text[start..=idx]);
                        start_idx = None;
                    }
                }
            }
        }
    }
    results
}

