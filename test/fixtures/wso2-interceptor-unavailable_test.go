package interceptorservice

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"sort"
	"testing"
	"time"

	policy "github.com/wso2/api-platform/sdk/core/policy/v1alpha2"
)

const mahaLatencyRepetitions = 9

type mahaLatencySummary struct {
	Samples        int       `json:"samples"`
	SamplesMillis []float64 `json:"samplesMillis"`
	MinMillis     float64   `json:"minMillis"`
	MedianMillis  float64   `json:"medianMillis"`
	P95Millis     float64   `json:"p95Millis"`
	MaxMillis     float64   `json:"maxMillis"`
}

func summarizeMahaLatency(samples []float64) mahaLatencySummary {
	sorted := append([]float64(nil), samples...)
	sort.Float64s(sorted)
	p95Index := (95*len(sorted)+99)/100 - 1
	return mahaLatencySummary{
		Samples:        len(samples),
		SamplesMillis: samples,
		MinMillis:     sorted[0],
		MedianMillis:  sorted[len(sorted)/2],
		P95Millis:     sorted[p95Index],
		MaxMillis:     sorted[len(sorted)-1],
	}
}

func measureMahaLatency(t *testing.T, invoke func() policy.RequestAction, assertAction func(policy.RequestAction)) mahaLatencySummary {
	t.Helper()
	samples := make([]float64, 0, mahaLatencyRepetitions)
	for i := 0; i < mahaLatencyRepetitions; i++ {
		started := time.Now()
		action := invoke()
		samples = append(samples, float64(time.Since(started).Microseconds())/1000)
		assertAction(action)
	}
	return summarizeMahaLatency(samples)
}

// This fixture is copied into the pinned WSO2 interceptor-service module by
// Maha's failure-path runner. It exercises a genuine connection refusal, which
// upstream's timeout and HTTP-500 tests do not cover separately.
func TestMahaUnavailableInterceptorFailsClosed(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserve unavailable endpoint: %v", err)
	}
	endpoint := "http://" + listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("close unavailable endpoint: %v", err)
	}

	p := mustGetPolicy(t, map[string]interface{}{
		"endpoint": endpoint,
		"request": map[string]interface{}{"passthroughOnError": false},
	})
	action := p.OnRequestBody(context.Background(), reqCtx(`{}`), nil)
	response, ok := action.(policy.ImmediateResponse)
	if !ok {
		t.Fatalf("expected ImmediateResponse, got %T", action)
	}
	if response.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status mismatch: %d", response.StatusCode)
	}
}

// TestMahaRepeatedPolicyLatency measures the exact policy boundary repeatedly.
// It never contacts a model provider. The marker is parsed by Maha's runner and
// retained as individual samples so a median cannot conceal a wide range.
func TestMahaRepeatedPolicyLatency(t *testing.T) {
	healthyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer healthyServer.Close()
	healthyPolicy := mustGetPolicy(t, map[string]interface{}{
		"endpoint": healthyServer.URL,
		"request":  map[string]interface{}{"passthroughOnError": false},
	})
	healthy := measureMahaLatency(t, func() policy.RequestAction {
		return healthyPolicy.OnRequestBody(context.Background(), reqCtx(`{}`), nil)
	}, func(action policy.RequestAction) {
		if _, ok := action.(policy.UpstreamRequestModifications); !ok {
			t.Fatalf("healthy interceptor: expected UpstreamRequestModifications, got %T", action)
		}
	})

	timeoutServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(150 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer timeoutServer.Close()
	timeoutPolicy := mustGetPolicy(t, map[string]interface{}{
		"endpoint":      timeoutServer.URL,
		"timeoutMillis": 100,
		"request":       map[string]interface{}{"passthroughOnError": false},
	})
	timedOut := measureMahaLatency(t, func() policy.RequestAction {
		return timeoutPolicy.OnRequestBody(context.Background(), reqCtx(`{}`), nil)
	}, func(action policy.RequestAction) {
		response, ok := action.(policy.ImmediateResponse)
		if !ok || response.StatusCode != http.StatusInternalServerError {
			t.Fatalf("timeout: expected immediate 500, got %T %+v", action, action)
		}
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserve unavailable endpoint: %v", err)
	}
	unavailableEndpoint := "http://" + listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("close unavailable endpoint: %v", err)
	}
	unavailablePolicy := mustGetPolicy(t, map[string]interface{}{
		"endpoint": unavailableEndpoint,
		"request":  map[string]interface{}{"passthroughOnError": false},
	})
	unavailable := measureMahaLatency(t, func() policy.RequestAction {
		return unavailablePolicy.OnRequestBody(context.Background(), reqCtx(`{}`), nil)
	}, func(action policy.RequestAction) {
		response, ok := action.(policy.ImmediateResponse)
		if !ok || response.StatusCode != http.StatusInternalServerError {
			t.Fatalf("unavailable: expected immediate 500, got %T %+v", action, action)
		}
	})

	result := map[string]mahaLatencySummary{
		"healthyInterceptor":     healthy,
		"interceptorTimeout":     timedOut,
		"interceptorUnavailable": unavailable,
	}
	encoded, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("encode latency evidence: %v", err)
	}
	fmt.Printf("MAHA_LATENCY_JSON:%s\n", encoded)
}
