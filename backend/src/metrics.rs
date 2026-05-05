use std::collections::HashMap;
use std::sync::Mutex;

/// Simple Prometheus-style metrics registry.
pub struct MetricsRegistry {
    inner: Mutex<Inner>,
}

struct Inner {
    counters: HashMap<String, Counter>,
    gauges: HashMap<String, Gauge>,
    histograms: HashMap<String, Histogram>,
}

struct Counter {
    help: String,
    value: u64,
}

struct Gauge {
    help: String,
    labels: HashMap<String, String>,
    value: f64,
}

struct Histogram {
    help: String,
    buckets: Vec<(f64, u64)>, // (le, count)
    sum: f64,
    count: u64,
}

impl MetricsRegistry {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                counters: HashMap::new(),
                gauges: HashMap::new(),
                histograms: HashMap::new(),
            }),
        }
    }

    pub fn inc_counter(&self, name: &str, help: &str) {
        let mut inner = self.lock();
        let entry = inner
            .counters
            .entry(name.to_string())
            .or_insert_with(|| Counter {
                help: help.to_string(),
                value: 0,
            });
        entry.help = help.to_string();
        entry.value += 1;
    }

    pub fn set_gauge(&self, name: &str, help: &str, value: f64) {
        let mut inner = self.lock();
        let entry = inner
            .gauges
            .entry(name.to_string())
            .or_insert_with(|| Gauge {
                help: help.to_string(),
                labels: HashMap::new(),
                value: 0.0,
            });
        entry.help = help.to_string();
        entry.value = value;
    }

    pub fn set_gauge_with_labels(&self, name: &str, help: &str, labels: &[(&str, &str)], value: f64) {
        let mut inner = self.lock();
        let entry = inner
            .gauges
            .entry(name.to_string())
            .or_insert_with(|| Gauge {
                help: help.to_string(),
                labels: HashMap::new(),
                value: 0.0,
            });
        entry.help = help.to_string();
        entry.labels.clear();
        for (k, v) in labels {
            entry.labels.insert(k.to_string(), v.to_string());
        }
        entry.value = value;
    }

    pub fn observe_histogram(&self, name: &str, help: &str, value: f64) {
        let mut inner = self.lock();
        let entry = inner
            .histograms
            .entry(name.to_string())
            .or_insert_with(|| {
                let buckets = vec![
                    (0.005, 0),
                    (0.01, 0),
                    (0.025, 0),
                    (0.05, 0),
                    (0.1, 0),
                    (0.25, 0),
                    (0.5, 0),
                    (1.0, 0),
                    (2.5, 0),
                    (5.0, 0),
                    (10.0, 0),
                ];
                Histogram {
                    help: help.to_string(),
                    buckets,
                    sum: 0.0,
                    count: 0,
                }
            });
        entry.help = help.to_string();
        entry.sum += value;
        entry.count += 1;
        for (le, count) in &mut entry.buckets {
            if value <= *le {
                *count += 1;
            }
        }
    }

    /// Render metrics in Prometheus text exposition format.
    pub fn render(&self) -> String {
        let inner = self.lock();
        let mut out = String::new();

        for (name, counter) in &inner.counters {
            out.push_str(&format!("# HELP {} {}\n", name, counter.help));
            out.push_str(&format!("# TYPE {} counter\n", name));
            out.push_str(&format!("{} {}\n", name, counter.value));
        }

        for (name, gauge) in &inner.gauges {
            out.push_str(&format!("# HELP {} {}\n", name, gauge.help));
            out.push_str(&format!("# TYPE {} gauge\n", name));
            if gauge.labels.is_empty() {
                out.push_str(&format!("{} {}\n", name, gauge.value));
            } else {
                let label_str: Vec<String> = gauge
                    .labels
                    .iter()
                    .map(|(k, v)| format!("{}=\"{}\"", k, v))
                    .collect();
                out.push_str(&format!(
                    "{}{{{}}} {}\n",
                    name,
                    label_str.join(","),
                    gauge.value
                ));
            }
        }

        for (name, hist) in &inner.histograms {
            out.push_str(&format!("# HELP {} {}\n", name, hist.help));
            out.push_str(&format!("# TYPE {} histogram\n", name));
            for (le, count) in &hist.buckets {
                out.push_str(&format!(
                    "{}_bucket{{le=\"{}\"}} {}\n",
                    name, le, count
                ));
            }
            out.push_str(&format!("{}_bucket{{le=\"+Inf\"}} {}\n", name, hist.count));
            out.push_str(&format!("{}_sum {}\n", name, hist.sum));
            out.push_str(&format!("{}_count {}\n", name, hist.count));
        }

        out
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        match self.inner.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        }
    }
}

/// Global metrics instance. Initialized in main.rs.
use std::sync::OnceLock;
static METRICS: OnceLock<MetricsRegistry> = OnceLock::new();

pub fn init_metrics() -> &'static MetricsRegistry {
    METRICS.get_or_init(MetricsRegistry::new)
}

pub fn get_metrics() -> &'static MetricsRegistry {
    METRICS.get().expect("Metrics not initialized")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counter() {
        let reg = MetricsRegistry::new();
        reg.inc_counter("test_total", "Test counter");
        reg.inc_counter("test_total", "Test counter");
        let output = reg.render();
        assert!(output.contains("test_total 2"));
    }

    #[test]
    fn test_gauge() {
        let reg = MetricsRegistry::new();
        reg.set_gauge("test_value", "Test gauge", 42.0);
        let output = reg.render();
        assert!(output.contains("test_value 42"));
    }

    #[test]
    fn test_histogram() {
        let reg = MetricsRegistry::new();
        reg.observe_histogram("test_latency_seconds", "Test latency", 0.3);
        reg.observe_histogram("test_latency_seconds", "Test latency", 2.0);
        let output = reg.render();
        assert!(output.contains("test_latency_seconds_bucket"));
        assert!(output.contains("test_latency_seconds_sum 2.3"));
        assert!(output.contains("test_latency_seconds_count 2"));
    }

    #[test]
    fn test_prometheus_format_headers() {
        let reg = MetricsRegistry::new();
        reg.inc_counter("test_total", "Test counter");
        let output = reg.render();
        assert!(output.contains("# HELP test_total Test counter"));
        assert!(output.contains("# TYPE test_total counter"));
    }

    #[test]
    fn test_gauge_with_labels() {
        let reg = MetricsRegistry::new();
        reg.set_gauge_with_labels(
            "test_labeled",
            "Labeled gauge",
            &[("status", "200"), ("endpoint", "/api/test")],
            1.0,
        );
        let output = reg.render();
        assert!(output.contains("test_labeled{"));
        assert!(output.contains("status=\"200\""));
    }
}
