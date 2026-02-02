package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestGenerateJWTManager(t *testing.T) {
	manager, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager: %v", err)
	}

	if manager.privateKey == nil {
		t.Error("Private key is nil")
	}
	if manager.publicKey == nil {
		t.Error("Public key is nil")
	}
}

func TestGenerateAccessToken(t *testing.T) {
	manager, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager: %v", err)
	}

	userID := uuid.New()
	email := "test@example.com"
	name := "Test User"

	token, err := manager.GenerateAccessToken(userID, email, name)
	if err != nil {
		t.Fatalf("Failed to generate access token: %v", err)
	}

	if token == "" {
		t.Error("Token is empty")
	}
}

func TestVerifyAccessToken(t *testing.T) {
	manager, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager: %v", err)
	}

	userID := uuid.New()
	email := "test@example.com"
	name := "Test User"

	token, err := manager.GenerateAccessToken(userID, email, name)
	if err != nil {
		t.Fatalf("Failed to generate access token: %v", err)
	}

	claims, err := manager.VerifyAccessToken(token)
	if err != nil {
		t.Fatalf("Failed to verify access token: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("Expected user ID %v, got %v", userID, claims.UserID)
	}
	if claims.Email != email {
		t.Errorf("Expected email %s, got %s", email, claims.Email)
	}
	if claims.Name != name {
		t.Errorf("Expected name %s, got %s", name, claims.Name)
	}
}

func TestVerifyInvalidToken(t *testing.T) {
	manager, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager: %v", err)
	}

	_, err = manager.VerifyAccessToken("invalid.token.here")
	if err != ErrInvalidToken {
		t.Errorf("Expected ErrInvalidToken, got %v", err)
	}
}

func TestVerifyTokenFromDifferentKey(t *testing.T) {
	manager1, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager 1: %v", err)
	}

	manager2, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager 2: %v", err)
	}

	userID := uuid.New()
	token, err := manager1.GenerateAccessToken(userID, "test@example.com", "Test")
	if err != nil {
		t.Fatalf("Failed to generate access token: %v", err)
	}

	// Token signed by manager1 should not be verifiable by manager2
	_, err = manager2.VerifyAccessToken(token)
	if err != ErrInvalidToken {
		t.Errorf("Expected ErrInvalidToken when verifying with different key, got %v", err)
	}
}

func TestTokenExpiry(t *testing.T) {
	// This test verifies that the token has proper expiry claims
	manager, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager: %v", err)
	}

	userID := uuid.New()
	token, err := manager.GenerateAccessToken(userID, "test@example.com", "Test")
	if err != nil {
		t.Fatalf("Failed to generate access token: %v", err)
	}

	claims, err := manager.VerifyAccessToken(token)
	if err != nil {
		t.Fatalf("Failed to verify access token: %v", err)
	}

	// Check that expiry is about 15 minutes from now
	expectedExpiry := time.Now().Add(15 * time.Minute)
	actualExpiry := claims.ExpiresAt.Time

	// Allow 1 minute tolerance
	if actualExpiry.Before(expectedExpiry.Add(-1*time.Minute)) || actualExpiry.After(expectedExpiry.Add(1*time.Minute)) {
		t.Errorf("Token expiry %v is not approximately 15 minutes from now (%v)", actualExpiry, expectedExpiry)
	}
}

func TestGetPublicKeyPEM(t *testing.T) {
	manager, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager: %v", err)
	}

	pem, err := manager.GetPublicKeyPEM()
	if err != nil {
		t.Fatalf("Failed to get public key PEM: %v", err)
	}

	if pem == "" {
		t.Error("Public key PEM is empty")
	}

	if !contains(pem, "-----BEGIN PUBLIC KEY-----") {
		t.Error("Public key PEM doesn't have proper header")
	}
}

func TestGetPrivateKeyPEM(t *testing.T) {
	manager, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager: %v", err)
	}

	pem := manager.GetPrivateKeyPEM()
	if pem == "" {
		t.Error("Private key PEM is empty")
	}

	if !contains(pem, "-----BEGIN RSA PRIVATE KEY-----") {
		t.Error("Private key PEM doesn't have proper header")
	}
}

func TestNewJWTManagerFromPEM(t *testing.T) {
	// Generate keys first
	originalManager, err := GenerateJWTManager()
	if err != nil {
		t.Fatalf("Failed to generate JWT manager: %v", err)
	}

	privatePEM := originalManager.GetPrivateKeyPEM()
	publicPEM, err := originalManager.GetPublicKeyPEM()
	if err != nil {
		t.Fatalf("Failed to get public key PEM: %v", err)
	}

	// Create new manager from PEM
	newManager, err := NewJWTManagerFromPEM(privatePEM, publicPEM)
	if err != nil {
		t.Fatalf("Failed to create JWT manager from PEM: %v", err)
	}

	// Generate token with original, verify with new
	userID := uuid.New()
	token, err := originalManager.GenerateAccessToken(userID, "test@example.com", "Test")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := newManager.VerifyAccessToken(token)
	if err != nil {
		t.Fatalf("Failed to verify token with new manager: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("Expected user ID %v, got %v", userID, claims.UserID)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsAt(s, substr, 0))
}

func containsAt(s, substr string, start int) bool {
	for i := start; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
