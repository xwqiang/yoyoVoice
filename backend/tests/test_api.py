def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_admin_login_and_create_parent(client):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "123456"})
    assert login.status_code == 200
    admin_token = login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    create = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": "parent_test",
            "password": "test1234",
            "display_name": "测试家长",
            "account_name": "测试家庭",
        },
    )
    assert create.status_code == 201

    parent_login = client.post(
        "/api/auth/login",
        json={"username": "parent_test", "password": "test1234"},
    )
    assert parent_login.status_code == 200
    parent_token = parent_login.json()["access_token"]
    parent_headers = {"Authorization": f"Bearer {parent_token}"}

    courses = client.get("/api/courses", headers=parent_headers)
    assert courses.status_code == 200
    assert len(courses.json()) >= 2

    forbidden = client.post(
        "/api/users",
        headers=parent_headers,
        json={"username": "other", "password": "test1234"},
    )
    assert forbidden.status_code == 403
