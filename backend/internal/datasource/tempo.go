package datasource

import (
	"context"
	"fmt"
	"time"

	"github.com/janhoon/dash/backend/internal/models"
)

// TempoClient is used for trace datasource connectivity checks.
type TempoClient struct {
	datasource models.DataSource
}

func NewTempoClient(ds models.DataSource) (*TempoClient, error) {
	if ds.URL == "" {
		return nil, fmt.Errorf("datasource url is required")
	}

	return &TempoClient{datasource: ds}, nil
}

func (c *TempoClient) Query(ctx context.Context, query string, start, end time.Time, step time.Duration, limit int) (*QueryResult, error) {
	_ = ctx
	_ = query
	_ = start
	_ = end
	_ = step
	_ = limit

	return nil, fmt.Errorf("tempo datasource does not support /query; use tracing endpoints")
}

func (c *TempoClient) TestConnection(ctx context.Context) error {
	return runHTTPConnectionCheck(ctx, c.datasource, []string{"/ready", "/api/search?limit=1", "/"})
}
