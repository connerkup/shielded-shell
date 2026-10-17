## 2023-10-17 - Case-insensitive Environment Variable Filtering
**Vulnerability:** The sandbox stripped sensitive environment variables (like AWS_, OPENAI_ keys) using a case-sensitive prefix check, allowing lowercase equivalents to bypass the filter.
**Learning:** Environment variables may be set using various cases depending on the system or configuration. Hardcoded uppercase prefix matching in JavaScript is insufficient.
**Prevention:** Always convert keys to a uniform case (e.g., uppercase) before checking against prefixes or use case-insensitive regex.
