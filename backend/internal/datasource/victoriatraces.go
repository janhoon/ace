package datasource

import (
	"context"
	"fmt"
	"time"

	"github.com/janhoon/dash/backend/internal/models"
)

// VictoriaTracesClient is used for trace datasource connectivity checks.
type VictoriaTracesClient struct {
	datasource models.DataSource
}

func NewVictoriaTracesClient(ds models.DataSource) (*VictoriaTracesClient, error) {
	if ds.URL == "" {
		return nil, fmt.Errorf("datasource url is required")
	}

	return &VictoriaTracesClient{datasource: ds}, nil
}

func (c *VictoriaTracesClient) Query(ctx context.Context, query string, start, end time.Time, step time.Duration, limit int) (*QueryResult, error) {
	_ = ctx
	_ = query
	_ = start
	_ = end
	_ = step
	_ = limit

	return nil, fmt.Errorf("victoriatraces datasource does not support /query; use tracing endpoints")
}

func (c *VictoriaTracesClient) TestConnection(ctx context.Context) error {
	return runHTTPConnectionCheck(ctx, c.datasource, []string{"/health", "/ready", "/"})
}
