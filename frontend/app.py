import streamlit as st
import requests

BACKEND_URL = "http://127.0.0.1:8000"

st.set_page_config(page_title="CRM Email Blaster", layout="wide")

st.title("📧 Email Blaster Dashboard")

st.write("Send bulk emails from your CSV lists safely.")

# -----------------------------
# INPUT
# -----------------------------
file_name = st.text_input("Enter CSV file name (must be in /data folder):")

# -----------------------------
# PREVIEW CSV
# -----------------------------
if file_name:
    col1, col2, col3 = st.columns(3)

    with col1:
        if st.button("👀 Preview CSV"):
            with st.spinner("Loading preview..."):
                res = requests.get(
                    f"{BACKEND_URL}/preview-csv",
                    params={"file_name": file_name}
                )

                if res.status_code == 200:
                    data = res.json()

                    st.success(f"Total Rows: {data['total_rows']}")
                    st.write("Columns:", data["columns"])
                    st.dataframe(data["preview"])
                else:
                    st.error(res.text)

    # -----------------------------
    # CONFIRM EMAIL LIST
    # -----------------------------
    with col2:
        if st.button("✅ Confirm Email List"):
            with st.spinner("Validating emails..."):
                res = requests.get(
                    f"{BACKEND_URL}/confirm-send",
                    params={"file_name": file_name}
                )

                if res.status_code == 200:
                    data = res.json()

                    st.success(f"Valid Emails: {data['total_valid_emails']}")
                    st.write("Sample Emails:", data["sample_emails"])
                else:
                    st.error(res.text)

    # -----------------------------
    # SEND EMAILS
    # -----------------------------
    with col3:
        if st.button("🚀 Send Emails"):
            confirm = st.checkbox("I confirm I want to send emails")

            if confirm:
                with st.spinner("Sending emails..."):
                    res = requests.post(
                        f"{BACKEND_URL}/send-bulk",
                        params={"file_name": file_name}
                    )

                    if res.status_code == 200:
                        data = res.json()

                        st.success("Emails sent successfully!")
                        st.write("Details:", data)
                    else:
                        st.error(res.text)
            else:
                st.warning("Please confirm before sending emails.")