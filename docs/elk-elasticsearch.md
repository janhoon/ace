# ELK with Ace (No Kibana)

Ace can be used as the query, Explore, and dashboard layer on top of Elasticsearch/Logstash without requiring Kibana.

## Local quick start (Docker Compose)

This repository ships ELK containers behind the `elk` profile:

```bash
docker compose --profile elk up -d elasticsearch logstash
```

- Elasticsearch listens on `http://localhost:9200`
- Logstash pipeline file: `logstash/pipeline/logstash.conf`
- Note: the default Logstash pipeline tails Docker log files under `/var/lib/docker/containers` (best on Linux hosts).

## 1) Send logs from Logstash to Elasticsearch

The provided local pipeline (`logstash/pipeline/logstash.conf`) tails Docker JSON logs from
`/var/lib/docker/containers/*/*-json.log`, enriches them with compose metadata, and writes to:

- `dash-logs-%{+YYYY.MM.dd}`

You can customize that pipeline if you prefer Beats/HTTP inputs, but no extra shipper is required for local Docker development.

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
