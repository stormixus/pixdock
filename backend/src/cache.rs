use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// A simple TTL-based cache with explicit invalidation.
/// Not full LRU — keys are evicted by TTL expiry or explicit invalidation.
pub struct DockerCache {
    inner: Mutex<HashMap<String, CacheEntry>>,
    max_entries: usize,
}

struct CacheEntry {
    value: serde_json::Value,
    expires_at: Instant,
}

impl DockerCache {
    pub fn new(max_entries: usize) -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            max_entries,
        }
    }

    /// Get a cached value. Returns `None` if missing or expired.
    pub fn get(&self, key: &str) -> Option<serde_json::Value> {
        let mut map = match self.inner.lock() {
            Ok(lock) => lock,
            Err(poisoned) => poisoned.into_inner(),
        };

        let entry = map.get(key)?;
        if Instant::now() > entry.expires_at {
            map.remove(key);
            return None;
        }
        Some(entry.value.clone())
    }

    /// Set a value with a given TTL.
    pub fn set(&self, key: String, value: serde_json::Value, ttl: Duration) {
        let mut map = match self.inner.lock() {
            Ok(lock) => lock,
            Err(poisoned) => poisoned.into_inner(),
        };

        // Evict oldest entries if over capacity
        while map.len() >= self.max_entries {
            let oldest_key = map
                .iter()
                .min_by_key(|(_, e)| e.expires_at)
                .map(|(k, _)| k.clone());
            if let Some(k) = oldest_key {
                map.remove(&k);
            } else {
                break;
            }
        }

        map.insert(
            key,
            CacheEntry {
                value,
                expires_at: Instant::now() + ttl,
            },
        );
    }

    /// Invalidate all cache entries whose key starts with the given prefix.
    /// Returns the number of entries removed.
    pub fn invalidate(&self, prefix: &str) -> usize {
        let mut map = match self.inner.lock() {
            Ok(lock) => lock,
            Err(poisoned) => poisoned.into_inner(),
        };

        let before = map.len();
        map.retain(|key, _| !key.starts_with(prefix));
        before - map.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_get_set() {
        let cache = DockerCache::new(100);
        cache.set(
            "test".to_string(),
            serde_json::json!({"hello": "world"}),
            Duration::from_secs(60),
        );
        assert_eq!(
            cache.get("test"),
            Some(serde_json::json!({"hello": "world"}))
        );
    }

    #[test]
    fn test_cache_expiry() {
        let cache = DockerCache::new(100);
        cache.set(
            "test".to_string(),
            serde_json::json!("value"),
            Duration::ZERO,
        );
        assert_eq!(cache.get("test"), None);
    }

    #[test]
    fn test_cache_missing() {
        let cache = DockerCache::new(100);
        assert_eq!(cache.get("nonexistent"), None);
    }

    #[test]
    fn test_cache_invalidate() {
        let cache = DockerCache::new(100);
        cache.set(
            "containers:list".to_string(),
            serde_json::json!([]),
            Duration::from_secs(60),
        );
        cache.set(
            "services:list".to_string(),
            serde_json::json!([]),
            Duration::from_secs(60),
        );
        cache.set(
            "images:list".to_string(),
            serde_json::json!([]),
            Duration::from_secs(60),
        );

        let removed = cache.invalidate("containers");
        assert_eq!(removed, 1);
        assert_eq!(cache.get("containers:list"), None);
        assert!(cache.get("services:list").is_some());
        assert!(cache.get("images:list").is_some());
    }

    #[test]
    fn test_cache_invalidate_prefix() {
        let cache = DockerCache::new(100);
        cache.set(
            "containers:list".to_string(),
            serde_json::json!([]),
            Duration::from_secs(60),
        );
        cache.set(
            "containers:abc123".to_string(),
            serde_json::json!({}),
            Duration::from_secs(60),
        );

        let removed = cache.invalidate("containers");
        assert_eq!(removed, 2);
    }

    #[test]
    fn test_cache_capacity_eviction() {
        let cache = DockerCache::new(2);
        cache.set(
            "a".to_string(),
            serde_json::json!(1),
            Duration::from_secs(60),
        );
        cache.set(
            "b".to_string(),
            serde_json::json!(2),
            Duration::from_secs(60),
        );
        cache.set(
            "c".to_string(),
            serde_json::json!(3),
            Duration::from_secs(60),
        );
        assert_eq!(cache.get("c"), Some(serde_json::json!(3)));
        // One of a or b should be evicted
        let remaining = [cache.get("a"), cache.get("b")];
        assert!(remaining.iter().any(|v| v.is_none()));
    }
}
