"""Generate a bcrypt hash for a test password."""
import bcrypt

password = "testpass123"
hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

print(f"Password: {password}")
print(f"Hash: {hashed}")
