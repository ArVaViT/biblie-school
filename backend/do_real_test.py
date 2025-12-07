"""Реальный тест регистрации через API"""
import requests
import json
import time

timestamp = int(time.time())
email = f"real_test_{timestamp}@example.com"

data = {
    "email": email,
    "password": "testpass123",
    "full_name": f"Real Test User {timestamp}"
}

print(f"Тестирую регистрацию:")
print(f"Email: {email}")
print(f"URL: https://biblie-school-backend.vercel.app/api/v1/auth/test-register")

try:
    response = requests.post(
        "https://biblie-school-backend.vercel.app/api/v1/auth/test-register",
        json=data,
        headers={
            "Content-Type": "application/json",
            "Origin": "https://biblie-school-frontend.vercel.app"
        },
        timeout=30
    )
    
    result = {
        "status": response.status_code,
        "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
        "email_used": email
    }
    
    with open("real_test_result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"\nСтатус: {response.status_code}")
    if response.status_code == 201:
        print("✅ УСПЕХ! Пользователь создан")
        user_data = response.json().get('user', {})
        print(f"ID: {user_data.get('id')}")
        print(f"Email: {user_data.get('email')}")
    else:
        print(f"❌ ОШИБКА")
        print(json.dumps(response.json() if hasattr(response, 'json') else response.text, indent=2))
    
except Exception as e:
    error = {"error": str(e), "email_used": email}
    with open("real_test_result.json", "w", encoding="utf-8") as f:
        json.dump(error, f, indent=2, ensure_ascii=False)
    print(f"❌ ОШИБКА: {e}")
