from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_execute_python():
    resp = client.post("/execute", json={"language": "python", "code": "print(2 + 3)"})
    assert resp.status_code == 200
    assert resp.json()["output"].strip() == "5"


def test_unsupported_language():
    resp = client.post("/execute", json={"language": "ruby", "code": "puts 1"})
    assert resp.status_code == 400


def test_rejects_dangerous_python_pattern():
    resp = client.post("/execute", json={"language": "python", "code": "import socket\nprint('nope')"})
    assert resp.status_code == 400
