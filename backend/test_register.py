#!/usr/bin/env python3
"""Test registration via the real API."""
import requests
import json
import sys
import os
from datetime import datetime

API_URL = "https://biblie-school-backend.vercel.app/api/v1/auth/register"
OUTPUT_FILE = "test_register_result.json"


def test_register(email, password, full_name):
    """Test user registration."""
    print(f"\n{'='*60}")
    print("Testing registration")
    print(f"{'='*60}")
    print(f"URL: {API_URL}")
    print(f"Email: {email}")
    print(f"Name: {full_name}")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"{'='*60}\n")

    data = {
        "email": email,
        "password": password,
        "full_name": full_name,
    }

    headers = {
        "Content-Type": "application/json",
        "Origin": "https://biblie-school-frontend.vercel.app",
    }

    try:
        print("Sending POST request...")
        response = requests.post(API_URL, json=data, headers=headers, timeout=30)

        print(f"\nStatus code: {response.status_code}")
        print("Response headers:")
        for key, value in response.headers.items():
            if key.lower().startswith("access-control") or key.lower() == "content-type":
                print(f"  {key}: {value}")

        print("\nResponse body:")
        try:
            response_json = response.json()
            print(json.dumps(response_json, indent=2, ensure_ascii=False))

            if response.status_code == 201:
                print(f"\nSUCCESS! User registered:")
                print(f"   ID: {response_json.get('user', {}).get('id', 'N/A')}")
                print(f"   Email: {response_json.get('user', {}).get('email', 'N/A')}")
                print(f"   Name: {response_json.get('user', {}).get('full_name', 'N/A')}")
                token_status = "yes" if response_json.get("access_token") else "no"
                print(f"   Token received: {token_status}")

                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(response_json, f, indent=2, ensure_ascii=False)
                print(f"\nResult saved to {OUTPUT_FILE}")

                return True
            else:
                print(f"\nFAILED: {response.status_code}")
                return False

        except json.JSONDecodeError:
            print(response.text)
            return False

    except requests.exceptions.RequestException as e:
        print(f"\nREQUEST ERROR: {str(e)}")
        error_info = {
            "error": str(e),
            "error_type": type(e).__name__,
            "status_code": getattr(e.response, "status_code", None) if hasattr(e, "response") else None,
            "response_text": e.response.text if hasattr(e, "response") and e.response else None,
        }
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(error_info, f, indent=2, ensure_ascii=False)
        print(f"Error saved to {OUTPUT_FILE}")
        return False


if __name__ == "__main__":
    timestamp = int(datetime.now().timestamp())

    email1 = f"test_user_{timestamp}@example.com"
    test_register(email1, "testpass123", "Test User")

    timestamp2 = timestamp + 1
    email2 = f"test_user_{timestamp2}@example.com"
    test_register(email2, "mypassword456", "Another User")

    print(f"\n{'='*60}")
    print("Test 3: Attempt to register with existing email (should fail)")
    print(f"{'='*60}\n")
    test_register(email1, "anotherpass", "Duplicate User")
