package auth

import (
	"strings"
	"testing"
)

func TestHashPassword(t *testing.T) {
	password := "TestPassword123!"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	if hash == "" {
		t.Error("Hash is empty")
	}

	// Check hash format
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Errorf("Hash doesn't have argon2id prefix: %s", hash)
	}
}

func TestHashPasswordUnique(t *testing.T) {
	password := "TestPassword123!"
	hash1, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to hash password (1): %v", err)
	}

	hash2, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to hash password (2): %v", err)
	}

	// Same password should produce different hashes due to random salt
	if hash1 == hash2 {
		t.Error("Same password produced identical hashes - salt not working")
	}
}

func TestVerifyPasswordCorrect(t *testing.T) {
	password := "TestPassword123!"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	valid, err := VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("Failed to verify password: %v", err)
	}

	if !valid {
		t.Error("Valid password should verify as correct")
	}
}

func TestVerifyPasswordIncorrect(t *testing.T) {
	password := "TestPassword123!"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	valid, err := VerifyPassword("WrongPassword123!", hash)
	if err != nil {
		t.Fatalf("Failed to verify password: %v", err)
	}

	if valid {
		t.Error("Invalid password should not verify as correct")
	}
}

func TestVerifyPasswordInvalidHash(t *testing.T) {
	_, err := VerifyPassword("password", "not-a-valid-hash")
	if err != ErrInvalidHash {
		t.Errorf("Expected ErrInvalidHash, got %v", err)
	}
}

func TestVerifyPasswordEmptyHash(t *testing.T) {
	_, err := VerifyPassword("password", "")
	if err != ErrInvalidHash {
		t.Errorf("Expected ErrInvalidHash for empty hash, got %v", err)
	}
}

func TestHashFormat(t *testing.T) {
	password := "TestPassword123!"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	// Format: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
	parts := strings.Split(hash, "$")
	if len(parts) != 6 {
		t.Errorf("Expected 6 parts in hash, got %d: %s", len(parts), hash)
	}

	if parts[1] != "argon2id" {
		t.Errorf("Expected argon2id algorithm, got %s", parts[1])
	}

	if parts[2] != "v=19" {
		t.Errorf("Expected v=19, got %s", parts[2])
	}

	if parts[3] != "m=65536,t=3,p=4" {
		t.Errorf("Expected m=65536,t=3,p=4, got %s", parts[3])
	}
}

func TestHashPasswordVariousInputs(t *testing.T) {
	passwords := []string{
		"short",
		"averagepassword123",
		"VeryLongPasswordWithSpecialChars!@#$%^&*()_+-=[]{}|;':\",./<>?",
		"Unicode日本語パスワード",
		"", // Empty password
	}

	for _, password := range passwords {
		hash, err := HashPassword(password)
		if err != nil {
			t.Errorf("Failed to hash password '%s': %v", password, err)
			continue
		}

		valid, err := VerifyPassword(password, hash)
		if err != nil {
			t.Errorf("Failed to verify password '%s': %v", password, err)
			continue
		}

		if !valid {
			t.Errorf("Password '%s' should verify correctly", password)
		}
	}
}
