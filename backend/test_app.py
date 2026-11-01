"""Tests for: Expense Tracker API. Every test starts with an EMPTY database (see fresh_db)."""

import os
import tempfile
import uuid
from datetime import date

import pytest
from fastapi import HTTPException

os.environ["AF_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")  # must be set before importing the app

from fastapi.testclient import TestClient  # noqa: E402

from backend.app import app, current_user, get_conn  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db():
    """Empty every table before each test, so tests never see each other's rows."""
    with get_conn() as conn:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")]
        for table in tables:
            conn.execute(f'DELETE FROM "{table}"')
    yield


def unique(prefix: str = "user") -> str:
    return prefix + "_" + uuid.uuid4().hex[:8]


def test_create_expense():
    response = client.post(
        "/api/expenses",
        json={"amount": 12.5, "category": "Food", "description": "Lunch", "date": "2025-08-15"},
    )
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data["id"], int)
    assert data["amount"] == 12.5
    assert data["category"] == "Food"
    assert data["description"] == "Lunch"
    assert data["date"] == "2025-08-15"


def test_create_expense_without_description():
    response = client.post(
        "/api/expenses",
        json={"amount": 5.0, "category": "Transport", "date": "2025-08-16"},
    )
    assert response.status_code == 201
    assert response.json()["description"] is None


def test_list_expenses():
    client.post("/api/expenses", json={"amount": 10.0, "category": "Food", "date": "2025-08-01"})
    client.post("/api/expenses", json={"amount": 20.0, "category": "Rent", "date": "2025-08-31"})

    response = client.get("/api/expenses")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_list_expenses_date_filter():
    client.post("/api/expenses", json={"amount": 10.0, "category": "Food", "date": "2025-08-01"})
    client.post("/api/expenses", json={"amount": 20.0, "category": "Rent", "date": "2025-08-31"})
    client.post("/api/expenses", json={"amount": 30.0, "category": "Food", "date": "2025-09-01"})

    response = client.get("/api/expenses?start_date=2025-08-01&end_date=2025-08-31")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_delete_expense():
    created = client.post(
        "/api/expenses", json={"amount": 10.0, "category": "Food", "date": "2025-08-01"}
    ).json()

    response = client.delete(f"/api/expenses/{created['id']}")
    assert response.status_code == 204

    response = client.delete("/api/expenses/999999")
    assert response.status_code == 404


def test_budget_default_and_set():
    response = client.get("/api/budget")
    assert response.status_code == 200
    assert response.json()["daily_limit"] == 0

    response = client.post("/api/budget", json={"daily_limit": 50.0})
    assert response.status_code == 200
    assert response.json()["daily_limit"] == 50.0

    response = client.get("/api/budget")
    assert response.status_code == 200
    assert response.json()["daily_limit"] == 50.0


def test_stats_empty():
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_today"] == 0
    assert data["remaining_today"] == 0
    assert data["total_this_month"] == 0
    assert data["by_category"] == []
    assert data["daily_budget_limit"] == 0


def test_stats_with_expenses():
    today = date.today().isoformat()
    client.post("/api/expenses", json={"amount": 10.0, "category": "Food", "date": today})
    client.post("/api/expenses", json={"amount": 5.0, "category": "Transport", "date": today})
    client.post("/api/budget", json={"daily_limit": 50.0})

    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_today"] == 15.0
    assert data["remaining_today"] == 35.0
    assert data["total_this_month"] == 15.0
    assert data["daily_budget_limit"] == 50.0
    assert data["by_category"] == [
        {"category": "Food", "total": 10.0},
        {"category": "Transport", "total": 5.0},
    ]


def test_create_expense_validation():
    assert client.post("/api/expenses", json={"amount": 0, "category": "Food", "date": "2025-08-01"}).status_code == 400
    assert client.post("/api/expenses", json={"amount": 10.0, "date": "2025-08-01"}).status_code == 400
    assert client.post(
        "/api/expenses", json={"amount": 10.0, "category": "Food", "date": "not-a-date"}
    ).status_code == 400


def test_budget_validation():
    assert client.post("/api/budget", json={"daily_limit": -1}).status_code == 400


def test_list_expenses_invalid_query():
    assert client.get("/api/expenses?start_date=not-a-date").status_code == 400


def test_current_user_invalid_token():
    with pytest.raises(HTTPException) as exc:
        current_user(None)
    assert exc.value.status_code == 401
