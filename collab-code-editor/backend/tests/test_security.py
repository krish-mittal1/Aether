from src.utils.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hash_roundtrip():
    hashed = hash_password("password123")
    assert hashed != "password123"
    assert verify_password("password123", hashed)
    assert not verify_password("wrong", hashed)


def test_long_password_hash_roundtrip():
    password = "correct horse battery staple " * 20
    hashed = hash_password(password)
    assert verify_password(password, hashed)
    assert not verify_password(password + "nope", hashed)


def test_jwt_roundtrip():
    token = create_access_token("user-1", {"username": "alice"})
    payload = decode_access_token(token)
    assert payload["sub"] == "user-1"
    assert payload["username"] == "alice"
