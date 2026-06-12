from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_register_login_courses():
    email = "pytest@example.com"
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "test1234", "display_name": "测试"},
    )
    login = client.post("/api/auth/login", json={"email": email, "password": "test1234"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    courses = client.get("/api/courses", headers=headers)
    assert courses.status_code == 200
    assert len(courses.json()) >= 2
