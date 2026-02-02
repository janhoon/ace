package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/janhoon/dash/backend/internal/auth"
	"github.com/janhoon/dash/backend/internal/db"
)

var testPool *pgxpool.Pool
var testJWTManager *auth.JWTManager
var testAuthHandler *AuthHandler

func TestMain(m *testing.M) {
	// Setup test database
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://dash:dash@localhost:5432/dash_test?sslmode=disable"
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, dbURL)
	if err != nil {
		// Skip tests if database is not available
		os.Exit(0)
	}
	testPool = pool

	// Run migrations
	if err := db.RunMigrations(ctx, testPool); err != nil {
		pool.Close()
		os.Exit(1)
	}

	// Setup JWT manager
	testJWTManager, err = auth.GenerateJWTManager()
	if err != nil {
		pool.Close()
		os.Exit(1)
	}

	testAuthHandler = NewAuthHandler(testPool, testJWTManager)

	// Run tests
	code := m.Run()

	// Cleanup
	testPool.Exec(ctx, "DELETE FROM users WHERE email LIKE 'test%@example.com'")
	pool.Close()
	os.Exit(code)
}

func TestRegisterUser(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	// Cleanup before test
	testPool.Exec(context.Background(), "DELETE FROM users WHERE email = 'testregister@example.com'")

	body := `{"email":"testregister@example.com","password":"TestPassword123!","name":"Test User"}`
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	testAuthHandler.Register(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d: %s", w.Code, w.Body.String())
	}

	var response AuthResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response.AccessToken == "" {
		t.Error("Expected access token in response")
	}
	if response.TokenType != "Bearer" {
		t.Errorf("Expected token type Bearer, got %s", response.TokenType)
	}
	if response.ExpiresIn != 900 {
		t.Errorf("Expected expires_in 900, got %d", response.ExpiresIn)
	}
}

func TestRegisterUserDuplicate(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	// Cleanup and create initial user
	testPool.Exec(context.Background(), "DELETE FROM users WHERE email = 'testdupe@example.com'")

	body := `{"email":"testdupe@example.com","password":"TestPassword123!","name":"Test User"}`
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	testAuthHandler.Register(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create first user: %d", w.Code)
	}

	// Try to register again
	req = httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	testAuthHandler.Register(w, req)

	if w.Code != http.StatusConflict {
		t.Errorf("Expected status 409 for duplicate email, got %d", w.Code)
	}
}

func TestRegisterUserInvalidEmail(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	body := `{"email":"not-an-email","password":"TestPassword123!","name":"Test User"}`
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	testAuthHandler.Register(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid email, got %d", w.Code)
	}
}

func TestRegisterUserWeakPassword(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	testCases := []struct {
		name     string
		password string
	}{
		{"too short", "Short1!"},
		{"no uppercase", "testpassword123!"},
		{"no lowercase", "TESTPASSWORD123!"},
		{"no digit", "TestPassword!"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body := `{"email":"testweak@example.com","password":"` + tc.password + `","name":"Test User"}`
			req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			testAuthHandler.Register(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400 for weak password '%s', got %d: %s", tc.password, w.Code, w.Body.String())
			}
		})
	}
}

func TestLoginCorrectPassword(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	// Cleanup and register user
	testPool.Exec(context.Background(), "DELETE FROM users WHERE email = 'testlogin@example.com'")

	regBody := `{"email":"testlogin@example.com","password":"TestPassword123!","name":"Test User"}`
	regReq := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regW := httptest.NewRecorder()
	testAuthHandler.Register(regW, regReq)

	if regW.Code != http.StatusCreated {
		t.Fatalf("Failed to register user: %d", regW.Code)
	}

	// Login
	loginBody := `{"email":"testlogin@example.com","password":"TestPassword123!"}`
	loginReq := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBufferString(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()

	testAuthHandler.Login(loginW, loginReq)

	if loginW.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", loginW.Code, loginW.Body.String())
	}

	var response AuthResponse
	if err := json.NewDecoder(loginW.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response.AccessToken == "" {
		t.Error("Expected access token in response")
	}
}

func TestLoginWrongPassword(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	// Cleanup and register user
	testPool.Exec(context.Background(), "DELETE FROM users WHERE email = 'testloginwrong@example.com'")

	regBody := `{"email":"testloginwrong@example.com","password":"TestPassword123!","name":"Test User"}`
	regReq := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regW := httptest.NewRecorder()
	testAuthHandler.Register(regW, regReq)

	// Login with wrong password
	loginBody := `{"email":"testloginwrong@example.com","password":"WrongPassword123!"}`
	loginReq := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBufferString(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()

	testAuthHandler.Login(loginW, loginReq)

	if loginW.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 for wrong password, got %d", loginW.Code)
	}
}

func TestLoginNonexistentUser(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	loginBody := `{"email":"nonexistent@example.com","password":"TestPassword123!"}`
	loginReq := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBufferString(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()

	testAuthHandler.Login(loginW, loginReq)

	if loginW.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 for nonexistent user, got %d", loginW.Code)
	}
}

func TestMeWithValidToken(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	// Cleanup and register user
	testPool.Exec(context.Background(), "DELETE FROM users WHERE email = 'testme@example.com'")

	regBody := `{"email":"testme@example.com","password":"TestPassword123!","name":"Test Me User"}`
	regReq := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regW := httptest.NewRecorder()
	testAuthHandler.Register(regW, regReq)

	var regResponse AuthResponse
	json.NewDecoder(regW.Body).Decode(&regResponse)

	// Call /me endpoint
	meReq := httptest.NewRequest("GET", "/api/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+regResponse.AccessToken)
	meW := httptest.NewRecorder()

	// We need to wrap the handler with the auth middleware
	wrappedHandler := auth.RequireAuth(testJWTManager, testAuthHandler.Me)
	wrappedHandler(meW, meReq)

	if meW.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", meW.Code, meW.Body.String())
	}

	var userResponse UserResponse
	if err := json.NewDecoder(meW.Body).Decode(&userResponse); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if userResponse.Email != "testme@example.com" {
		t.Errorf("Expected email testme@example.com, got %s", userResponse.Email)
	}
	if userResponse.Name == nil || *userResponse.Name != "Test Me User" {
		t.Errorf("Expected name 'Test Me User', got %v", userResponse.Name)
	}
}

func TestMeWithExpiredToken(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	// Use an invalid/expired token
	meReq := httptest.NewRequest("GET", "/api/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer invalid.token.here")
	meW := httptest.NewRecorder()

	wrappedHandler := auth.RequireAuth(testJWTManager, testAuthHandler.Me)
	wrappedHandler(meW, meReq)

	if meW.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 for invalid token, got %d", meW.Code)
	}
}

func TestMeWithoutToken(t *testing.T) {
	meReq := httptest.NewRequest("GET", "/api/auth/me", nil)
	meW := httptest.NewRecorder()

	wrappedHandler := auth.RequireAuth(testJWTManager, testAuthHandler.Me)
	wrappedHandler(meW, meReq)

	if meW.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 for missing token, got %d", meW.Code)
	}
}

func TestGetAuthMethods(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	ctx := context.Background()

	// Cleanup and register user with password
	testPool.Exec(ctx, "DELETE FROM users WHERE email = 'testmethods@example.com'")

	regBody := `{"email":"testmethods@example.com","password":"TestPassword123!","name":"Test Methods User"}`
	regReq := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regW := httptest.NewRecorder()
	testAuthHandler.Register(regW, regReq)

	var regResponse AuthResponse
	json.NewDecoder(regW.Body).Decode(&regResponse)

	// Get auth methods
	methodsReq := httptest.NewRequest("GET", "/api/auth/me/methods", nil)
	methodsReq.Header.Set("Authorization", "Bearer "+regResponse.AccessToken)
	methodsW := httptest.NewRecorder()

	wrappedHandler := auth.RequireAuth(testJWTManager, testAuthHandler.GetAuthMethods)
	wrappedHandler(methodsW, methodsReq)

	if methodsW.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", methodsW.Code, methodsW.Body.String())
	}

	var methods []AuthMethodResponse
	if err := json.NewDecoder(methodsW.Body).Decode(&methods); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Should have at least password method
	if len(methods) < 1 {
		t.Error("Expected at least one auth method (password)")
	}

	// First method should be password
	if len(methods) > 0 && methods[0].Provider != "password" {
		t.Errorf("Expected first method to be password, got %s", methods[0].Provider)
	}
}

func TestUnlinkLastAuthMethodFails(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	ctx := context.Background()

	// Cleanup and register user with only password
	testPool.Exec(ctx, "DELETE FROM users WHERE email = 'testunlink@example.com'")

	regBody := `{"email":"testunlink@example.com","password":"TestPassword123!","name":"Test Unlink User"}`
	regReq := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regW := httptest.NewRecorder()
	testAuthHandler.Register(regW, regReq)

	var regResponse AuthResponse
	json.NewDecoder(regW.Body).Decode(&regResponse)

	// Try to unlink password (uuid.Nil)
	unlinkReq := httptest.NewRequest("DELETE", "/api/auth/me/methods/00000000-0000-0000-0000-000000000000", nil)
	unlinkReq.Header.Set("Authorization", "Bearer "+regResponse.AccessToken)
	unlinkReq.SetPathValue("id", "00000000-0000-0000-0000-000000000000")
	unlinkW := httptest.NewRecorder()

	wrappedHandler := auth.RequireAuth(testJWTManager, testAuthHandler.UnlinkAuthMethod)
	wrappedHandler(unlinkW, unlinkReq)

	if unlinkW.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for unlinking last method, got %d: %s", unlinkW.Code, unlinkW.Body.String())
	}
}

func TestUnlinkSSOMethod(t *testing.T) {
	if testPool == nil {
		t.Skip("Database not available")
	}

	ctx := context.Background()

	// Cleanup and create user with password + SSO
	testPool.Exec(ctx, "DELETE FROM users WHERE email = 'testunlinksso@example.com'")

	// Create user with password
	regBody := `{"email":"testunlinksso@example.com","password":"TestPassword123!","name":"Test Unlink SSO"}`
	regReq := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(regBody))
	regReq.Header.Set("Content-Type", "application/json")
	regW := httptest.NewRecorder()
	testAuthHandler.Register(regW, regReq)

	var regResponse AuthResponse
	json.NewDecoder(regW.Body).Decode(&regResponse)

	// Get user ID
	claims, _ := testJWTManager.VerifyAccessToken(regResponse.AccessToken)
	userID := claims.UserID

	// Add SSO method
	var methodID uuid.UUID
	testPool.QueryRow(ctx,
		`INSERT INTO user_auth_methods (user_id, provider, provider_user_id)
		 VALUES ($1, 'google', 'google-123') RETURNING id`,
		userID,
	).Scan(&methodID)
	defer testPool.Exec(ctx, `DELETE FROM user_auth_methods WHERE user_id = $1`, userID)

	// Unlink SSO method
	unlinkReq := httptest.NewRequest("DELETE", "/api/auth/me/methods/"+methodID.String(), nil)
	unlinkReq.Header.Set("Authorization", "Bearer "+regResponse.AccessToken)
	unlinkReq.SetPathValue("id", methodID.String())
	unlinkW := httptest.NewRecorder()

	wrappedHandler := auth.RequireAuth(testJWTManager, testAuthHandler.UnlinkAuthMethod)
	wrappedHandler(unlinkW, unlinkReq)

	if unlinkW.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", unlinkW.Code, unlinkW.Body.String())
	}

	// Verify method is gone
	var count int
	testPool.QueryRow(ctx, `SELECT COUNT(*) FROM user_auth_methods WHERE id = $1`, methodID).Scan(&count)
	if count != 0 {
		t.Error("SSO method should be deleted")
	}
}
