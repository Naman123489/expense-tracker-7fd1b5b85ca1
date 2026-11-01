"""Backend: Expense Tracker API"""

import hashlib
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

DB_PATH = os.environ.get("AF_DB", str(Path(__file__).resolve().parent / "app.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS budget (
    id INTEGER PRIMARY KEY,
    daily_limit REAL NOT NULL
);
"""


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


with get_conn() as _conn:
    _conn.executescript(SCHEMA)

app = FastAPI(title="Expense Tracker API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request, exc):
    return JSONResponse(status_code=400, content={"detail": "Validation error"})


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, password_hash: str) -> bool:
    salt = password_hash.split("$", 1)[0]
    return secrets.compare_digest(hash_password(password, salt), password_hash)


def issue_token(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_hex(24)
    conn.execute("INSERT INTO tokens (token, user_id) VALUES (?, ?)", (token, user_id))
    return token


def current_user(authorization: str | None = Header(default=None)) -> sqlite3.Row:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    with get_conn() as conn:
        row = conn.execute(
            "SELECT users.id, users.username FROM tokens JOIN users ON users.id = tokens.user_id "
            "WHERE tokens.token = ?",
            (authorization[len("Bearer "):],),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="invalid token")
    return row


class Expense(BaseModel):
    id: int
    amount: float
    category: str
    description: Optional[str] = None
    date: str


class ExpenseCreate(BaseModel):
    amount: float = Field(gt=0)
    category: str = Field(min_length=1)
    description: Optional[str] = None
    date: str

    @field_validator("date")
    @classmethod
    def validate_date(cls, value: str) -> str:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Invalid date")
        try:
            date.fromisoformat(value)
        except ValueError:
            raise ValueError("Invalid date")
        return value


class Budget(BaseModel):
    daily_limit: float = Field(ge=0)


class BudgetUpdate(BaseModel):
    daily_limit: float = Field(ge=0)


class CategoryStat(BaseModel):
    category: str
    total: float


class StatsResponse(BaseModel):
    total_today: float
    remaining_today: float
    total_this_month: float
    by_category: List[CategoryStat]
    daily_budget_limit: float


def _row_to_expense(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "amount": row["amount"],
        "category": row["category"],
        "description": row["description"],
        "date": row["date"],
    }


def _validate_date_str(value: str) -> None:
    try:
        ExpenseCreate.validate_date(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/expenses", response_model=List[Expense])
def list_expenses(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
):
    if start_date is not None:
        _validate_date_str(start_date)
    if end_date is not None:
        _validate_date_str(end_date)

    query = "SELECT id, amount, category, description, date FROM expenses WHERE 1 = 1"
    params: list = []
    if start_date is not None:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date is not None:
        query += " AND date <= ?"
        params.append(end_date)
    query += " ORDER BY id"

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_row_to_expense(row) for row in rows]


@app.post("/api/expenses", status_code=201, response_model=Expense)
def create_expense(payload: ExpenseCreate):
    with get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO expenses (amount, category, description, date) VALUES (?, ?, ?, ?)",
            (payload.amount, payload.category, payload.description, payload.date),
        )
        row = conn.execute(
            "SELECT id, amount, category, description, date FROM expenses WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _row_to_expense(row)


@app.delete("/api/expenses/{id}", status_code=204)
def delete_expense(id: int):
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM expenses WHERE id = ?", (id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return None


@app.get("/api/budget", response_model=Budget)
def get_budget():
    with get_conn() as conn:
        row = conn.execute("SELECT daily_limit FROM budget ORDER BY id LIMIT 1").fetchone()
    daily_limit = float(row["daily_limit"]) if row is not None else 0.0
    return {"daily_limit": daily_limit}


@app.post("/api/budget", response_model=Budget)
def set_budget(payload: BudgetUpdate):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO budget (id, daily_limit) VALUES (1, ?)",
            (payload.daily_limit,),
        )
    return {"daily_limit": float(payload.daily_limit)}


@app.get("/api/stats", response_model=StatsResponse)
def get_stats():
    today = date.today().isoformat()
    month_prefix = today[:7]

    with get_conn() as conn:
        total_today = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE date = ?",
            (today,),
        ).fetchone()[0]
        total_this_month = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE substr(date, 1, 7) = ?",
            (month_prefix,),
        ).fetchone()[0]
        category_rows = conn.execute(
            "SELECT category, COALESCE(SUM(amount), 0) AS total "
            "FROM expenses GROUP BY category ORDER BY category"
        ).fetchall()
        budget_row = conn.execute(
            "SELECT daily_limit FROM budget ORDER BY id LIMIT 1"
        ).fetchone()

    daily_budget_limit = float(budget_row["daily_limit"]) if budget_row is not None else 0.0
    total_today = float(total_today)
    total_this_month = float(total_this_month)

    return {
        "total_today": total_today,
        "remaining_today": daily_budget_limit - total_today,
        "total_this_month": total_this_month,
        "by_category": [
            {"category": row["category"], "total": float(row["total"])}
            for row in category_rows
        ],
        "daily_budget_limit": daily_budget_limit,
    }
