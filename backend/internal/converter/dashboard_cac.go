package converter

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"go.yaml.in/yaml/v2"
)

const CurrentSchemaVersion = 1

type DashboardDocument struct {
	SchemaVersion int               `json:"schema_version" yaml:"schema_version"`
	Dashboard     DashboardResource `json:"dashboard" yaml:"dashboard"`
}

type DashboardResource struct {
	ID              *uuid.UUID         `json:"id,omitempty" yaml:"id,omitempty"`
	Title           string             `json:"title" yaml:"title"`
	Description     *string            `json:"description,omitempty" yaml:"description,omitempty"`
	Panels          []PanelResource    `json:"panels" yaml:"panels"`
	Variables       []VariableResource `json:"variables,omitempty" yaml:"variables,omitempty"`
	TimeRange       *TimeRangeResource `json:"time_range,omitempty" yaml:"time_range,omitempty"`
	RefreshInterval *string            `json:"refresh_interval,omitempty" yaml:"refresh_interval,omitempty"`
}

type PanelResource struct {
	Title        string          `json:"title" yaml:"title"`
	Type         string          `json:"type" yaml:"type"`
	GridPos      map[string]int  `json:"grid_pos" yaml:"grid_pos"`
	Query        json.RawMessage `json:"query,omitempty" yaml:"query,omitempty"`
	DataSourceID *uuid.UUID      `json:"datasource_id,omitempty" yaml:"datasource_id,omitempty"`
}

type VariableResource struct {
	Name       string `json:"name" yaml:"name"`
	Type       string `json:"type" yaml:"type"`
	Label      string `json:"label,omitempty" yaml:"label,omitempty"`
	Query      string `json:"query,omitempty" yaml:"query,omitempty"`
	Multi      bool   `json:"multi,omitempty" yaml:"multi,omitempty"`
	IncludeAll bool   `json:"include_all,omitempty" yaml:"include_all,omitempty"`
}

type TimeRangeResource struct {
	From string `json:"from" yaml:"from"`
	To   string `json:"to" yaml:"to"`
}

func NormalizeFormat(format string) string {
	normalized := strings.TrimSpace(strings.ToLower(format))
	switch normalized {
	case "", "json":
		return "json"
	case "yaml", "yml":
		return "yaml"
	default:
		return ""
	}
}

func DecodeDashboardDocument(data []byte, format string) (DashboardDocument, error) {
	normalized := NormalizeFormat(format)
	if normalized == "" {
		return DashboardDocument{}, errors.New("unsupported format")
	}

	var doc DashboardDocument
	var err error
	if normalized == "yaml" {
		err = yaml.Unmarshal(data, &doc)
	} else {
		err = json.Unmarshal(data, &doc)
	}
	if err != nil {
		return DashboardDocument{}, err
	}

	if doc.SchemaVersion == 0 {
		doc.SchemaVersion = CurrentSchemaVersion
	}

	if err := ValidateDashboardDocument(doc); err != nil {
		return DashboardDocument{}, err
	}

	return doc, nil
}

func EncodeDashboardDocument(doc DashboardDocument, format string) ([]byte, error) {
	normalized := NormalizeFormat(format)
	if normalized == "" {
		return nil, errors.New("unsupported format")
	}

	if err := ValidateDashboardDocument(doc); err != nil {
		return nil, err
	}

	if normalized == "yaml" {
		return yaml.Marshal(doc)
	}

	return json.MarshalIndent(doc, "", "  ")
}

func ValidateDashboardDocument(doc DashboardDocument) error {
	if doc.SchemaVersion != CurrentSchemaVersion {
		return fmt.Errorf("unsupported schema_version %d", doc.SchemaVersion)
	}

	if strings.TrimSpace(doc.Dashboard.Title) == "" {
		return errors.New("dashboard.title is required")
	}

	for i, panel := range doc.Dashboard.Panels {
		if strings.TrimSpace(panel.Title) == "" {
			return fmt.Errorf("dashboard.panels[%d].title is required", i)
		}
		if strings.TrimSpace(panel.Type) == "" {
			return fmt.Errorf("dashboard.panels[%d].type is required", i)
		}
		if panel.GridPos == nil {
			return fmt.Errorf("dashboard.panels[%d].grid_pos is required", i)
		}
		for _, key := range []string{"x", "y", "w", "h"} {
			if _, ok := panel.GridPos[key]; !ok {
				return fmt.Errorf("dashboard.panels[%d].grid_pos.%s is required", i, key)
			}
		}
		if panel.GridPos["w"] <= 0 || panel.GridPos["h"] <= 0 {
			return fmt.Errorf("dashboard.panels[%d].grid_pos width/height must be > 0", i)
		}
	}

	return nil
}
