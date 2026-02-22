# ELK with Ace (No Kibana)

Ace can be used as the query, Explore, and dashboard layer on top of Elasticsearch/Logstash without requiring Kibana.

## Local quick start (Docker Compose)

This repository ships ELK containers behind the `elk` profile:

```bash
docker compose --profile elk up -d elasticsearch logstash
```

- Elasticsearch listens on `http://localhost:9200`
- Logstash pipeline file: `logstash/pipeline/logstash.conf`

## 1) Send logs from Logstash to Elasticsearch

Example Logstash pipeline:

```conf
input {
  beats {
    port => 5044
  }
}

filter {
  # optional parsing/transforms
}

output {
  elasticsearch {
    hosts => ["http://elasticsearch:9200"]
    index => "dash-logs-%{+YYYY.MM.dd}"
  }
}
```

## 2) Verify Elasticsearch has documents

```bash
curl -s "http://localhost:9200/dash-logs-*/_search?size=1" | jq
```

## 3) Configure Elasticsearch datasource in Ace

In **Ace → Data Sources → Add Data Source**:

- **Type:** `Elasticsearch (ELK)`
- **URL:** `http://localhost:9200`
- **Default Index Pattern (optional):** `dash-logs-*`
- **Auth:**
  - none, or
  - basic / bearer / api-key (if your cluster requires auth)

## 4) Explore logs in Ace

Go to **Explore → Logs**, select your Elasticsearch datasource, and run a query.

Examples:

- Lucene query string:
  - `service.name:"api" AND level:error`
  - `trace.id:"abc123"`
- JSON DSL:

```json
{
  "index": "dash-logs-*",
  "query": {
    "query_string": {
      "query": "level:error"
    }
  },
  "size": 200
}
```

Ace automatically applies the selected time range as an Elasticsearch range filter.

## 5) Explore aggregations/metrics in Ace

Go to **Explore → Metrics**, select Elasticsearch, and run aggregation JSON.

```json
{
  "index": "dash-logs-*",
  "query": {
    "query_string": {
      "query": "service.name:api"
    }
  },
  "aggs": {
    "timeseries": {
      "date_histogram": {
        "field": "@timestamp",
        "fixed_interval": "30s",
        "min_doc_count": 0
      },
      "aggs": {
        "errors": {
          "filter": {
            "term": {
              "level.keyword": "error"
            }
          }
        }
      }
    }
  }
}
```

If no `aggs` are provided, Ace generates a default date-histogram document-count series.

## 6) Build dashboards

In dashboard panel editor:

- choose Elasticsearch datasource,
- select signal (`logs` or `metrics`),
- use the same query style as Explore.

This enables ELK-backed dashboards directly in Ace.
