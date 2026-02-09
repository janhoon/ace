package converter

import (
	"encoding/json"
	"fmt"
	"strings"
)

type grafanaEnvelope struct {
	Dashboard *grafanaDashboard `json:"dashboard"`
}

type grafanaDashboard struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Panels      []grafanaPanel `json:"panels"`
	Templating  struct {
		List []grafanaVariable `json:"list"`
	} `json:"templating"`
	Time    *grafanaTimeRange `json:"time"`
	Refresh string            `json:"refresh"`
}

type grafanaPanel struct {
	Title   string               `json:"title"`
	Type    string               `json:"type"`
	GridPos map[string]int       `json:"gridPos"`
	Targets []grafanaPanelTarget `json:"targets"`
}

type grafanaPanelTarget struct {
	RefID string `json:"refId"`
	Expr  string `json:"expr"`
	Query string `json:"query"`
}

type grafanaVariable struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Label      string `json:"label"`
	Query      string `json:"query"`
	Definition string `json:"definition"`
	Multi      bool   `json:"multi"`
	IncludeAll bool   `json:"includeAll"`
}

type grafanaTimeRange struct {
	From string `json:"from"`
	To   string `json:"to"`
}

func ConvertGrafanaDashboard(data []byte) (DashboardDocument, []string, error) {
	var envelope grafanaEnvelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		return DashboardDocument{}, nil, fmt.Errorf("invalid grafana JSON: %w", err)
	}

	dashboard := envelope.Dashboard
	if dashboard == nil {
		var raw grafanaDashboard
		if err := json.Unmarshal(data, &raw); err != nil {
			return DashboardDocument{}, nil, fmt.Errorf("invalid grafana dashboard: %w", err)
		}
		dashboard = &raw
	}

	if strings.TrimSpace(dashboard.Title) == "" {
		return DashboardDocument{}, nil, fmt.Errorf("grafana dashboard title is required")
	}

	warnings := make([]string, 0)
	panels := make([]PanelResource, 0, len(dashboard.Panels))
	for idx, panel := range dashboard.Panels {
		mappedType, warning := mapGrafanaPanelType(panel.Type)
		if warning != "" {
			warnings = append(warnings, fmt.Sprintf("panel[%d] %s", idx, warning))
		}

		if panel.GridPos == nil {
			panel.GridPos = map[string]int{"x": 0, "y": idx * 8, "w": 12, "h": 8}
		}

		query := map[string]string{}
		if len(panel.Targets) > 0 {
			target := panel.Targets[0]
			expr := strings.TrimSpace(target.Expr)
			if expr == "" {
				expr = strings.TrimSpace(target.Query)
			}
			if expr != "" {
				query["expr"] = expr
			}
			if target.RefID != "" {
				query["ref_id"] = target.RefID
			}
		}

		queryRaw := json.RawMessage("{}")
		if len(query) > 0 {
			encodedQuery, err := json.Marshal(query)
			if err != nil {
				return DashboardDocument{}, nil, fmt.Errorf("failed to encode panel query: %w", err)
			}
			queryRaw = encodedQuery
		}

		panelTitle := strings.TrimSpace(panel.Title)
		if panelTitle == "" {
			panelTitle = fmt.Sprintf("Panel %d", idx+1)
		}

		panels = append(panels, PanelResource{
			Title:   panelTitle,
			Type:    mappedType,
			GridPos: panel.GridPos,
			Query:   queryRaw,
		})
	}

	variables := make([]VariableResource, 0, len(dashboard.Templating.List))
	for _, variable := range dashboard.Templating.List {
		query := strings.TrimSpace(variable.Query)
		if query == "" {
			query = strings.TrimSpace(variable.Definition)
		}
		variables = append(variables, VariableResource{
			Name:       variable.Name,
			Type:       variable.Type,
			Label:      variable.Label,
			Query:      query,
			Multi:      variable.Multi,
			IncludeAll: variable.IncludeAll,
		})
	}

	var timeRange *TimeRangeResource
	if dashboard.Time != nil {
		timeRange = &TimeRangeResource{
			From: dashboard.Time.From,
			To:   dashboard.Time.To,
		}
	}

	doc := DashboardDocument{
		SchemaVersion: CurrentSchemaVersion,
		Dashboard: DashboardResource{
			Title:           dashboard.Title,
			Description:     optionalString(dashboard.Description),
			Panels:          panels,
			Variables:       variables,
			TimeRange:       timeRange,
			RefreshInterval: optionalString(dashboard.Refresh),
		},
	}

	if err := ValidateDashboardDocument(doc); err != nil {
		return DashboardDocument{}, nil, err
	}

	return doc, warnings, nil
}

func mapGrafanaPanelType(panelType string) (string, string) {
	switch strings.ToLower(strings.TrimSpace(panelType)) {
	case "graph", "timeseries":
		return "line", ""
	case "gauge":
		return "gauge", ""
	case "stat":
		return "stat", ""
	case "piechart", "pie chart":
		return "pie", ""
	case "logs":
		return "logs", ""
	default:
		return "line", fmt.Sprintf("unsupported panel type %q mapped to line", panelType)
	}
}

func optionalString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
