import alertmanagerLogo from '../assets/datasources/alertmanager-logo.svg'
import clickhouseLogo from '../assets/datasources/clickhouse-logo.svg'
import cloudwatchLogo from '../assets/datasources/cloudwatch-logo.svg'
import elasticsearchLogo from '../assets/datasources/elasticsearch-logo.svg'
import lokiLogo from '../assets/datasources/loki-logo.svg'
import prometheusLogo from '../assets/datasources/prometheus-logo.svg'
import tempoLogo from '../assets/datasources/tempo-logo.svg'
import victoriaLogsLogo from '../assets/datasources/victorialogs-logo.svg'
import victoriaMetricsLogo from '../assets/datasources/victoriametrics-logo.svg'
import victoriaTracesLogo from '../assets/datasources/victoriatraces-logo.svg'
import vmalertLogo from '../assets/datasources/vmalert-logo.svg'
import type { DataSourceType } from '../types/datasource'

export const dataSourceTypeLogos: Partial<Record<DataSourceType, string>> = {
  prometheus: prometheusLogo,
  loki: lokiLogo,
  victoriametrics: victoriaMetricsLogo,
  victorialogs: victoriaLogsLogo,
  tempo: tempoLogo,
  victoriatraces: victoriaTracesLogo,
  clickhouse: clickhouseLogo,
  cloudwatch: cloudwatchLogo,
  elasticsearch: elasticsearchLogo,
  vmalert: vmalertLogo,
  alertmanager: alertmanagerLogo,
}
