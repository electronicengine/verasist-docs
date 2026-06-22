"""Backend API tests for Turkish documentation platform."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:7010").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@dokuman.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_login_bad_password():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_login_success(token):
    assert isinstance(token, str) and len(token) > 10


def test_auth_me(auth_headers):
    r = requests.get(f"{API}/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


def test_auth_me_unauth():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_list_sections():
    r = requests.get(f"{API}/sections")
    assert r.status_code == 200
    sections = r.json()
    assert len(sections) >= 4
    slugs = {s["slug"] for s in sections}
    assert {"baslangic", "yapilandirma", "dagitim", "api-referansi"}.issubset(slugs)


def test_list_documents():
    r = requests.get(f"{API}/documents")
    assert r.status_code == 200
    docs = r.json()
    assert len(docs) >= 11


def test_get_document_giris():
    r = requests.get(f"{API}/documents/giris")
    assert r.status_code == 200
    d = r.json()
    assert d["title"] == "Giriş"
    assert "Platform Hakkında" in d["content"]


def test_get_document_404():
    r = requests.get(f"{API}/documents/yok-boyle-bir-sey")
    assert r.status_code == 404


def test_search_docker():
    r = requests.get(f"{API}/search", params={"q": "docker"})
    assert r.status_code == 200
    results = r.json()
    assert len(results) >= 2
    titles = " ".join(d.get("title", "") for d in results)
    assert "Docker" in titles or "Kurulum" in titles


def test_protected_create_section_unauth():
    r = requests.post(f"{API}/sections", json={"title": "TEST_x"})
    assert r.status_code == 401


def test_section_doc_crud(auth_headers):
    # CREATE section
    r = requests.post(f"{API}/sections", json={"title": "TEST_Bolum", "order": 99}, headers=auth_headers)
    assert r.status_code == 200
    section = r.json()
    sid = section["id"]
    assert section["title"] == "TEST_Bolum"

    # CREATE document
    r = requests.post(f"{API}/documents", json={
        "title": "TEST_Dok",
        "section_id": sid,
        "content": "<p>içerik docker</p>",
        "excerpt": "TEST",
    }, headers=auth_headers)
    assert r.status_code == 200
    doc = r.json()
    did = doc["id"]
    slug = doc["slug"]

    # GET via public endpoint
    r = requests.get(f"{API}/documents/{slug}")
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_Dok"

    # UPDATE
    r = requests.put(f"{API}/documents/{did}", json={
        "title": "TEST_Dok_Updated",
        "section_id": sid,
        "content": "<p>yeni</p>",
        "excerpt": "TEST",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_Dok_Updated"

    # DELETE doc
    r = requests.delete(f"{API}/documents/{did}", headers=auth_headers)
    assert r.status_code == 200

    # Verify deletion
    r = requests.get(f"{API}/documents/{slug}")
    assert r.status_code == 404

    # DELETE section
    r = requests.delete(f"{API}/sections/{sid}", headers=auth_headers)
    assert r.status_code == 200
