import requests
import streamlit as st

BACKEND_URL = "http://127.0.0.1:8000"


def api_get(path: str, params=None):
    r = requests.get(f"{BACKEND_URL}{path}", params=params, timeout=120)
    return r


def api_post(path: str, params=None, json=None, files=None, data=None):
    r = requests.post(
        f"{BACKEND_URL}{path}",
        params=params,
        json=json,
        files=files,
        data=data,
        timeout=600,
    )
    return r


def api_put(path: str, json=None):
    r = requests.put(f"{BACKEND_URL}{path}", json=json, timeout=30)
    return r


def api_delete(path: str):
    r = requests.delete(f"{BACKEND_URL}{path}", timeout=30)
    return r


st.set_page_config(
    page_title="Rooted Dominion — CRM",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.sidebar.title("Rooted Dominion")
page = st.sidebar.radio(
    "Navigate",
    [
        "Email Blaster",
        "Contacts",
        "Clients",
        "Campaign History",
        "Settings",
    ],
)

# ---------------------------------------------------------------------------
# PAGE 1 — Email Blaster
# ---------------------------------------------------------------------------
if page == "Email Blaster":
    st.title("📧 Email Blaster")
    st.caption("Send bulk emails from CSV files in the `/data` folder.")

    file_name = st.text_input("CSV file name (in `/data` folder)", key="blast_file")
    campaign_name = st.text_input(
        "Campaign name (optional, defaults to file name)",
        key="blast_campaign",
    )

    if file_name:
        c1, c2, c3 = st.columns(3)

        with c1:
            if st.button("👀 Preview CSV", key="prev"):
                with st.spinner("Loading preview..."):
                    res = api_get("/preview-csv", params={"file_name": file_name})
                    if res.status_code == 200:
                        data = res.json()
                        st.success(f"Total rows: {data['total_rows']}")
                        st.write("Columns:", data["columns"])
                        st.dataframe(data["preview"], use_container_width=True)
                    else:
                        st.error(res.text)

        with c2:
            if st.button("✅ Confirm list", key="conf"):
                with st.spinner("Validating..."):
                    res = api_get("/confirm-send", params={"file_name": file_name})
                    if res.status_code == 200:
                        data = res.json()
                        st.success(f"Valid emails: {data['total_valid_emails']}")
                        st.write("Sample:", data["sample_emails"])
                    else:
                        st.error(res.text)

        with c3:
            confirm = st.checkbox("I confirm I want to send", key="blast_confirm")
            if st.button("🚀 Send", key="send"):
                if not confirm:
                    st.warning("Please confirm before sending.")
                else:
                    with st.spinner("Sending (this may take a while)..."):
                        params = {"file_name": file_name}
                        cn = (campaign_name or "").strip()
                        if cn:
                            params["campaign_name"] = cn
                        res = api_post("/send-bulk", params=params)
                        if res.status_code == 200:
                            st.success("Send completed.")
                            st.json(res.json())
                        else:
                            st.error(res.text)
    else:
        st.info("Enter a CSV file name to begin.")

# ---------------------------------------------------------------------------
# PAGE 2 — Contacts
# ---------------------------------------------------------------------------
elif page == "Contacts":
    st.title("Contacts")
    st.caption("Licensed operators and leads.")

    up = st.file_uploader("Import contacts CSV", type=["csv"], key="contact_csv")
    if up and st.button("Upload & import", key="import_btn"):
        with st.spinner("Importing..."):
            files = {"file": (up.name, up.getvalue(), "text/csv")}
            r = api_post("/contacts/import-csv", files=files)
            if r.status_code == 200:
                st.success(r.json())
            else:
                st.error(r.text)

    search = st.text_input("Search (name, email, company)", key="c_search")
    lic = st.selectbox(
        "License type",
        ["All", "grower", "dispensary", "processor"],
        key="c_lic",
    )
    tags_f = st.text_input("Tag contains", key="c_tags")
    active_only = st.checkbox("Active only", value=False, key="c_active")

    params = {"active_only": active_only}
    if search.strip():
        params["search"] = search.strip()
    if lic != "All":
        params["license_type"] = lic
    if tags_f.strip():
        params["tags"] = tags_f.strip()

    r = api_get("/contacts", params=params)
    if r.status_code != 200:
        st.error(r.text)
        st.stop()

    contacts = r.json()
    if not contacts:
        st.warning("No contacts match your filters.")
    else:
        rows = [
            {
                "ID": c["id"],
                "Name": c.get("name") or "",
                "Company": c.get("company") or "",
                "Email": c["email"],
                "Phone": c.get("phone") or "",
                "License type": (c.get("license_type") or "").title(),
                "Last contacted": str(c.get("last_contacted") or ""),
                "Tags": c.get("tags") or "",
            }
            for c in contacts
        ]
        st.dataframe(rows, use_container_width=True, hide_index=True)

        labels = [
            f"{c['id']}: {(c.get('name') or c['email'])} <{c['email']}>"
            for c in contacts
        ]
        pick = st.selectbox("Select contact for details / edit / delete", labels)
        cid = contacts[labels.index(pick)]["id"]
        one = api_get(f"/contacts/{cid}")
        if one.status_code != 200:
            st.error(one.text)
        else:
            c = one.json()
            with st.expander("Full details", expanded=True):
                st.json(c)

            st.subheader("Edit contact")
            with st.form("edit_contact"):
                name = st.text_input("Name", value=c.get("name") or "")
                email = st.text_input("Email", value=c["email"])
                phone = st.text_input("Phone", value=c.get("phone") or "")
                company = st.text_input("Company", value=c.get("company") or "")
                license_number = st.text_input(
                    "License #", value=c.get("license_number") or ""
                )
                _lt_opts = ["", "grower", "dispensary", "processor"]
                _cur_lt = (c.get("license_type") or "").lower()
                _lt_i = (
                    _lt_opts.index(_cur_lt)
                    if _cur_lt in _lt_opts
                    else 0
                )
                license_type = st.selectbox(
                    "License type",
                    _lt_opts,
                    index=_lt_i,
                )
                city = st.text_input("City", value=c.get("city") or "")
                state = st.text_input("State", value=c.get("state") or "OK")
                tags = st.text_input("Tags (comma-separated)", value=c.get("tags") or "")
                notes = st.text_area("Notes", value=c.get("notes") or "")
                is_active = st.checkbox("Active", value=c.get("is_active", True))
                if st.form_submit_button("Save changes"):
                    body = {
                        "name": name or None,
                        "email": email,
                        "phone": phone or None,
                        "company": company or None,
                        "license_number": license_number or None,
                        "license_type": license_type or None,
                        "city": city or None,
                        "state": state or None,
                        "tags": tags or None,
                        "notes": notes or None,
                        "is_active": is_active,
                    }
                    pr = requests.put(
                        f"{BACKEND_URL}/contacts/{cid}",
                        json=body,
                        timeout=30,
                    )
                    if pr.status_code == 200:
                        st.success("Updated.")
                        st.rerun()
                    else:
                        st.error(pr.text)

            if st.button("Delete contact permanently", type="primary"):
                dr = api_delete(f"/contacts/{cid}")
                if dr.status_code == 200:
                    st.success("Deleted.")
                    st.rerun()
                else:
                    st.error(dr.text)

    st.divider()
    st.subheader("Create contact")
    with st.form("new_contact"):
        n_name = st.text_input("Name (new)")
        n_email = st.text_input("Email (new)", key="n_email")
        n_phone = st.text_input("Phone (new)")
        n_company = st.text_input("Company (new)")
        n_lic = st.text_input("License number (new)")
        n_lt = st.selectbox(
            "License type (new)",
            ["grower", "dispensary", "processor"],
            key="n_lt",
        )
        n_city = st.text_input("City (new)")
        n_state = st.text_input("State (new)", value="OK")
        n_tags = st.text_input("Tags (new)")
        n_notes = st.text_area("Notes (new)")
        if st.form_submit_button("Create"):
            body = {
                "name": n_name or None,
                "email": n_email,
                "phone": n_phone or None,
                "company": n_company or None,
                "license_number": n_lic or None,
                "license_type": n_lt,
                "city": n_city or None,
                "state": n_state or "OK",
                "tags": n_tags or None,
                "notes": n_notes or None,
            }
            cr = requests.post(f"{BACKEND_URL}/contacts", json=body, timeout=30)
            if cr.status_code == 200:
                st.success("Created.")
                st.rerun()
            else:
                st.error(cr.text)

# ---------------------------------------------------------------------------
# PAGE 3 — Clients
# ---------------------------------------------------------------------------
elif page == "Clients":
    st.title("Clients")
    r = api_get("/clients", params={"active_only": True})
    if r.status_code != 200:
        st.error(r.text)
        st.stop()
    clients = r.json()

    if not clients:
        st.info("No active clients yet. Create one via the API or add a form later.")
    else:
        for cl in clients:
            st.markdown(f"### {cl['name']}")
            st.write(
                f"**License type:** {(cl.get('license_type') or '—').title()}  \n"
                f"**Primary:** {cl.get('primary_contact_name') or '—'} — "
                f"{cl.get('primary_contact_email') or '—'}  \n"
                f"**City:** {cl.get('city') or '—'}"
            )
            st.markdown("---")

        pick_c = st.selectbox(
            "Open client profile",
            [f"{c['id']}: {c['name']}" for c in clients],
            key="cli_pick",
        )
        client_id = int(pick_c.split(":")[0])

        det = api_get(f"/clients/{client_id}")
        if det.status_code != 200:
            st.error(det.text)
        else:
            d = det.json()
            st.divider()
            st.header(d["name"])
            st.write(
                f"**License:** {d.get('license_number') or '—'} "
                f"({(d.get('license_type') or '').title()})"
            )
            st.write(
                f"**Primary contact:** {d.get('primary_contact_name') or '—'}  \n"
                f"{d.get('primary_contact_email') or '—'} · "
                f"{d.get('primary_contact_phone') or '—'}"
            )
            st.write(f"**Address:** {d.get('address') or '—'}")
            st.write(
                f"**City / State:** {d.get('city') or '—'}, {d.get('state') or 'OK'}"
            )
            st.write(f"**Notes:** {d.get('notes') or '—'}")

            st.subheader("Emails sent to this client")
            er = api_get(f"/clients/{client_id}/emails")
            if er.status_code == 200:
                emails = er.json()
                if emails:
                    st.dataframe(
                        [
                            {
                                "When": e.get("sent_at"),
                                "To": e["recipient_email"],
                                "Subject": e.get("subject") or "",
                                "OK": e.get("success"),
                            }
                            for e in emails
                        ],
                        use_container_width=True,
                        hide_index=True,
                    )
                else:
                    st.caption(
                        "No logged sends yet (matches when primary contact email equals recipient)."
                    )

            st.subheader("Campaign history")
            cr = api_get(f"/clients/{client_id}/campaigns")
            if cr.status_code == 200:
                camps = cr.json()
                if camps:
                    st.dataframe(
                        [
                            {
                                "Date": x.get("date_sent"),
                                "Campaign": x["campaign_name"],
                                "File": x.get("file_used") or "",
                                "Sent": x["total_sent"],
                                "Failed": x["total_failed"],
                                "Skipped": x["total_skipped"],
                            }
                            for x in camps
                        ],
                        use_container_width=True,
                        hide_index=True,
                    )
                else:
                    st.caption("No campaigns linked to this client yet.")

            st.subheader("Timeline notes")
            nr = api_get(f"/clients/{client_id}/notes")
            if nr.status_code == 200:
                for note in nr.json():
                    st.write(f"**{note.get('created_at')}** — {note['note']}")

            with st.form("add_note"):
                note_txt = st.text_area("New note")
                if st.form_submit_button("Add note"):
                    pr = requests.post(
                        f"{BACKEND_URL}/clients/{client_id}/notes",
                        json={"note": note_txt},
                        timeout=30,
                    )
                    if pr.status_code == 200:
                        st.success("Note added.")
                        st.rerun()
                    else:
                        st.error(pr.text)

# ---------------------------------------------------------------------------
# PAGE 4 — Campaign History
# ---------------------------------------------------------------------------
elif page == "Campaign History":
    st.title("Campaign history")
    r = api_get("/campaigns")
    if r.status_code != 200:
        st.error(r.text)
        st.stop()
    logs = r.json()
    if not logs:
        st.info("No campaigns logged yet.")
    else:
        st.dataframe(
            [
                {
                    "ID": x["id"],
                    "Date": x.get("date_sent"),
                    "Campaign": x["campaign_name"],
                    "File": x.get("file_used") or "",
                    "Sent": x["total_sent"],
                    "Failed": x["total_failed"],
                    "Skipped": x["total_skipped"],
                }
                for x in logs
            ],
            use_container_width=True,
            hide_index=True,
        )
        ids = [str(x["id"]) for x in logs]
        sel = st.selectbox("Campaign detail", ids)
        if sel:
            dr = api_get(f"/campaigns/{sel}")
            if dr.status_code == 200:
                st.json(dr.json())
            else:
                st.error(dr.text)

# ---------------------------------------------------------------------------
# PAGE 5 — Settings
# ---------------------------------------------------------------------------
elif page == "Settings":
    st.title("Settings")
    r = api_get("/settings")
    if r.status_code != 200:
        st.error(r.text)
        st.stop()
    s = r.json()
    st.write(f"**FROM_EMAIL:** `{s['from_email']}`")
    st.write(
        "**SendGrid:** "
        + ("configured (API key present)" if s["sendgrid_configured"] else "not configured")
    )
    st.caption(
        "TEST_MODE is saved under `data/crm_settings.json` and read by the API when sending. "
        "Set `TEST_EMAIL` in the server's environment for the test recipient address."
    )

    with st.form("settings_save"):
        tm = st.checkbox(
            "TEST_MODE (bulk sends go to test address only)",
            value=s["test_mode"],
        )
        if st.form_submit_button("Save settings"):
            pr = api_put("/settings", json={"test_mode": tm})
            if pr.status_code == 200:
                st.success("Saved.")
                st.rerun()
            else:
                st.error(pr.text)
