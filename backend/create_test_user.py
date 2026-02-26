"""Create a test user via the API to verify the full registration flow."""
import requests
import json
import time

API_URL = "https://biblie-school-backend.vercel.app/api/v1/auth/test-register"


def create_test_user(email_suffix=None):
    """Create a test user via the API."""
    timestamp = int(time.time())

    if email_suffix:
        email = f"test_{email_suffix}_{timestamp}@example.com"
    else:
        email = f"test_user_{timestamp}@example.com"

    data = {
        "email": email,
        "password": "testpass123",
        "full_name": f"Test User {timestamp}",
    }

    print(f"\n{'='*70}")
    print("Creating test user via API")
    print(f"{'='*70}")
    print(f"URL: {API_URL}")
    print(f"Email: {email}")
    print(f"Password: testpass123")
    print(f"Name: Test User {timestamp}")
    print(f"{'='*70}\n")

    try:
        response = requests.post(
            API_URL,
            json=data,
            headers={
                "Content-Type": "application/json",
                "Origin": "https://biblie-school-frontend.vercel.app",
            },
            timeout=30,
        )

        result = {
            "timestamp": timestamp,
            "request_data": data,
            "status_code": response.status_code,
            "response_headers": dict(response.headers),
        }

        try:
            response_json = response.json()
            result["response_data"] = response_json

            if response.status_code == 201:
                print("SUCCESS! User created via API:")
                print(f"   ID: {response_json.get('user', {}).get('id', 'N/A')}")
                print(f"   Email: {response_json.get('user', {}).get('email', 'N/A')}")
                print(f"   Name: {response_json.get('user', {}).get('full_name', 'N/A')}")
                print(f"   Role: {response_json.get('user', {}).get('role', 'N/A')}")
                token_status = "received" if response_json.get("access_token") else "missing"
                print(f"   Token: {token_status}")
                result["success"] = True
            else:
                print(f"FAILED: Status code {response.status_code}")
                print(f"   Details: {response_json.get('detail', 'N/A')}")
                result["success"] = False

        except json.JSONDecodeError:
            result["response_text"] = response.text
            result["success"] = False
            print("FAILED: Could not parse JSON response")
            print(f"   Response: {response.text[:500]}")

        filename = f"test_user_result_{timestamp}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\nResult saved to: {filename}")

        return result

    except requests.exceptions.RequestException as e:
        error_result = {
            "timestamp": timestamp,
            "request_data": data,
            "error": str(e),
            "error_type": type(e).__name__,
            "success": False,
        }

        if hasattr(e, "response") and e.response:
            error_result["status_code"] = e.response.status_code
            try:
                error_result["response_data"] = e.response.json()
            except Exception:
                error_result["response_text"] = e.response.text

        filename = f"test_user_error_{timestamp}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(error_result, f, indent=2, ensure_ascii=False)

        print(f"REQUEST ERROR: {str(e)}")
        print(f"Details saved to: {filename}")

        return error_result


if __name__ == "__main__":
    print("Creating test users via API...\n")

    result1 = create_test_user("api_basic")

    time.sleep(1)
    result2 = create_test_user("api_second")

    time.sleep(1)
    timestamp3 = int(time.time())
    data3 = {
        "email": f"test_unicode_{timestamp3}@example.com",
        "password": "testpass123",
        "full_name": f"Unicode User {timestamp3}",
    }

    print(f"\n{'='*70}")
    print("Test 3: User with Unicode name")
    print(f"{'='*70}")
    try:
        response3 = requests.post(
            API_URL,
            json=data3,
            headers={
                "Content-Type": "application/json",
                "Origin": "https://biblie-school-frontend.vercel.app",
            },
            timeout=30,
        )

        if response3.status_code == 201:
            print("SUCCESS!")
            print(json.dumps(response3.json(), indent=2, ensure_ascii=False))
        else:
            print(f"FAILED: {response3.status_code}")
            print(response3.text)
    except Exception as e:
        print(f"ERROR: {e}")

    print(f"\n{'='*70}")
    print("Testing complete!")
    print(f"{'='*70}")
