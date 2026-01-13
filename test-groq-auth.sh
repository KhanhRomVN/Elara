#!/bin/bash

echo "Testing Groq/Stytch Auth Endpoint with curl..."

# Using the same headers and credentials as captured in the logs
curl -v -X POST "https://api.stytchb2b.groq.com/sdk/v1/b2b/sessions/authenticate" \
  -H "host: api.stytchb2b.groq.com" \
  -H "authorization: Basic cHVibGljLXRva2VuLWxpdmUtNThkZjU3YTktYTFmNS00MDY2LWJjMGMtMmZmOTQyZGI2ODRmOmtjLVFPbXlJSVJDVE9lWnhUdTBaalMwZEdQWFhheXF0QTlFMEZMQ21UVG9f" \
  -H "content-type: application/json" \
  -H "origin: https://console.groq.com" \
  -H "referer: https://console.groq.com/" \
  -H "user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36" \
  -H "x-sdk-client: eyJldmVudF9pZCI6ImV2ZW50LWlkLTdlNTA3Yjg2LTBhNTQtNDg1OC04YTI0LWY5ODA1YTBlMTAxOCIsImFwcF9zZXNzaW9uX2lkIjoiYXBwLXNlc3Npb24taWQtMWRiZDZmYzItMjNhOS00NGUzLTlmNmUtMTdhMjZkOTUxM2IzIiwicGVyc2lzdGVudF9pZCI6InBlcnNpc3RlbnQtaWQtYWI2NmM4MWItZWVlMi00Njk2LTgxZmUtNWE4ZDRhMTc0YWJjIiwiY2xpZW50X3NlbnRfYXQiOiIyMDI2LTAxLTEzVDE2OjA5OjEwLjI1MloiLCJ0aW1lem9uZSI6IkFzaWEvU2FpZ29uIiwic3R5dGNoX21lbWJlcl9pZCI6Im1lbWJlci1saXZlLTAxNjdlMWFmLTYxZTYtNDM0ZC04ZGFiLWM3ODQ5NWNjMThhNSIsInN0eXRjaF9tZW1iZXJfc2Vzc2lvbl9pZCI6Im1lbWJlci1zZXNzaW9uLWxpdmUtMDNkZjkyZTgtMWQ0NC00OGM0LTgyODctNGMzODdhNzdiYjVmIiwiYXBwIjp7ImlkZW50aWZpZXIiOiJjb25zb2xlLmdyb3EuY29tIn0sInNkayI6eyJpZGVudGlmaWVyIjoiU3R5dGNoLmpzIEphdmFzY3JpcHQgU0RLIiwidmVyc2lvbiI6IjUuNDMuMCJ9fQ==" \
  -H "x-sdk-parent-host: https://console.groq.com" \
  -d "{}"
