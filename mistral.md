1/ POST https://auth.mistral.ai/self-service/login?flow=59befc0f-ca51-454b-8063-b290834310aa

{
"request": {
"host": "auth.mistral.ai",
"connection": "keep-alive",
"content-length": "195",
"sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\"",
"accept": "application/json",
"content-type": "application/json",
"sec-ch-ua-mobile": "?0",
"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
"sec-ch-ua-platform": "\"Linux\"",
"sec-fetch-site": "same-site",
"sec-fetch-mode": "cors",
"sec-fetch-dest": "empty",
"referer": "https://v2.auth.mistral.ai/",
"accept-encoding": "gzip, deflate, br",
"accept-language": "en-US",
"cookie": "**cflb=04dTofjtHwhfCny3TibYMM4LURzprwact2p8DyNXQf; **cf_bm=N0HWW0b2vqlACNWzHQb0BQHeJDQeVKWdpPKtX7gwZA0-1768225596-1.0.1.1-388iOYGgZ.vH7na_bggKIU9AkfJNuigLqKWp.1uJT530AwfFEjVymz5pFh6N.bSngxhZT_q5g5_NT5SiC4gCqBl2TMdSal3zX7fxmATkQ60; csrf_token_1d61ec8f0158ec4868343239ec73dbe1bfebad9908ad860e62f470c767573d0d=XTy9nafxU7Lu2hCmvwVjmXAp23uh3k42DCIVb2f0Tsw=; \_cfuvid=ob0bGX2XZAAjtJcS_5KSFfDQUdpszXmS2tekJMF2i3Q-1768225628040-0.0.1.1-604800000"
},
"response": {
"date": "Mon, 12 Jan 2026 13:47:46 GMT",
"content-type": "application/json; charset=utf-8",
"transfer-encoding": "chunked",
"connection": "keep-alive",
"cf-ray": "9bcd1b8189e787e1-SIN",
"cache-control": "private, no-cache, no-store, must-revalidate",
"set-cookie": [
"csrf_token_1d61ec8f0158ec4868343239ec73dbe1bfebad9908ad860e62f470c767573d0d=b5BBIlRkEawiStxGsPb59f4PDV2TTkPVWphUUP2Cc4s=; Path=/; Domain=mistral.ai; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax",
"ory_session_coolcurranf83m3srkfl=MTc2ODIyNTY2NnxoSlF4dXpzSm9NZHFzRVpsemtJQkJoTERfQzBsR3Q1QnpGV2FyWHExd3JYX09qN2tLM2NlY2pyNG9Id2trNlBfd2g3VlEzS1VjdVdJNWRmNzR2Wk9GOGdtMzNZczVqMWdIQUJRSlBpNG9yVFE2RW1idWR6Q2xyQVNkVkNoU1JRWmRJUnZTUWJQdEJPYUkzUDduZ1c0WkowekRPSTRpWXRGenNLbzJaeEp6RlpCVXhtX1BHZ1E5dDhtOXNhaU9JVlJNMUZWR1YxNmlfdjk0blpJYm5uOE42V0drN2pCUXBQYjV0Y1dTelFRUkhVYTY4V19ZVFRyNDZJNEY0eGtvcmY3b1pDMDQxYXlGcThCVEg2RFJwemN8IOxk9IG_LclNE3UyF6KIKtyfGGYMcfWXVRaDoXkVtrY=; Path=/; Domain=mistral.ai; Expires=Sun, 12 Apr 2026 13:47:45 GMT; Max-Age=7775999; HttpOnly; Secure; SameSite=Lax"
],
"vary": "Origin,Origin,Cookie, accept-encoding",
"permissions-policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), usb=()",
"referrer-policy": "strict-origin-when-cross-origin",
"x-content-type-options": "nosniff",
"x-frame-options": "DENY",
"ory-network-ingress": "T",
"ory-network-region": "euw",
"via": "1.1 google",
"alt-svc": "h3=\":443\"; ma=86400",
"cf-cache-status": "DYNAMIC",
"strict-transport-security": "max-age=15552000; includeSubDomains; preload",
"server": "cloudflare"
}
}

{
"request": "{\"csrf_token\":\"6T9/bemlkqiVW5GkvB9Q1/0++oL0BsMlim30NPW7Uzu0A8LwTlTBGnuBgQIDGjNOjRch+VXYjROGT+Fbkk8d9w==\",\"identifier\":\"thienbaovn2468@gmail.com\",\"method\":\"password\",\"password\":\"Thienbao@13579vn\"}",
"response": "{\"session\":{\"id\":\"7efb4c05-eb68-4242-8bed-676f1a267a2d\",\"active\":true,\"expires_at\":\"2026-04-12T13:47:45.808352149Z\",\"authenticated_at\":\"2026-01-12T13:47:45.808352149Z\",\"authenticator_assurance_level\":\"aal1\",\"authentication_methods\":[{\"method\":\"password\",\"aal\":\"aal1\",\"completed_at\":\"2026-01-12T13:47:45.808264775Z\"}],\"issued_at\":\"2026-01-12T13:47:45.810837126Z\",\"identity\":{\"id\":\"c4b7dd41-0982-4b94-b2f2-0694eba0f5f6\",\"schema_id\":\"b0168217ab36324041fcd102b9cd241cb4db9380fb7ae6c6491b3a1fa6b5633b8eb9c7c562c573a6cddcc1363baa79cdc299e78b16fa6260b0f062ef1186c55b\",\"schema_url\":\"https://auth.mistral.ai/schemas/YjAxNjgyMTdhYjM2MzI0MDQxZmNkMTAyYjljZDI0MWNiNGRiOTM4MGZiN2FlNmM2NDkxYjNhMWZhNmI1NjMzYjhlYjljN2M1NjJjNTczYTZjZGRjYzEzNjNiYWE3OWNkYzI5OWU3OGIxNmZhNjI2MGIwZjA2MmVmMTE4NmM1NWI\",\"state\":\"active\",\"state_changed_at\":\"2026-01-12T13:11:15.329693Z\",\"traits\":{\"email\":\"thienbaovn2468@gmail.com\",\"name\":{\"first\":\"Thien\",\"last\":\"Bao\"}},\"verifiable_addresses\":[{\"id\":\"883843a3-a5b6-4906-a3c1-05d87d4dbd59\",\"value\":\"thienbaovn2468@gmail.com\",\"verified\":true,\"via\":\"email\",\"status\":\"completed\",\"verified_at\":\"2026-01-12T13:11:43.259314Z\",\"created_at\":\"2026-01-12T13:11:15.337341Z\",\"updated_at\":\"2026-01-12T13:11:15.337341Z\"}],\"recovery_addresses\":[{\"id\":\"cb05716a-473b-4cdd-8d0a-489a64cdf199\",\"value\":\"thienbaovn2468@gmail.com\",\"via\":\"email\",\"created_at\":\"2026-01-12T13:11:15.576644Z\",\"updated_at\":\"2026-01-12T13:11:15.576644Z\"}],\"metadata_public\":null,\"created_at\":\"2026-01-12T13:11:15.331893Z\",\"updated_at\":\"2026-01-12T13:11:15.331893Z\",\"organization_id\":null},\"devices\":[{\"id\":\"47925a56-fe8d-4f9f-9830-67cdb3e19ef0\",\"ip_address\":\"171.236.70.9\",\"user_agent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\",\"location\":\"Long Xuyên, VN\"}]},\"continue_with\":[{\"action\":\"redirect_browser_to\",\"redirect_browser_to\":\"https://console.mistral.ai/build/playground\"}]}\n"
}

2/ GET https://console.mistral.ai/api/users/me
{
"request": {
"host": "console.mistral.ai",
"connection": "keep-alive",
"sec-ch-ua": "\"Not*A Brand\";v=\"8\", \"Chromium\";v=\"120\"",
"sec-ch-ua-mobile": "?0",
"x-csrftoken": "5p6wK3MgXzxcxaIgC9YdXPxfDAXDwODR",
"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
"sec-ch-ua-platform": "\"Linux\"",
"accept": "*/\_",
"sec-fetch-site": "same-origin",
"sec-fetch-mode": "cors",
"sec-fetch-dest": "empty",
"referer": "https://console.mistral.ai/build/playground",
"accept-encoding": "gzip, deflate, br",
"accept-language": "en-US",
"cookie": "**cflb=0H28vBt3Asif1pksrBB47e5ijRcsvN5X5q49HEah1xY; csrftoken=5p6wK3MgXzxcxaIgC9YdXPxfDAXDwODR; **cf_bm=N0HWW0b2vqlACNWzHQb0BQHeJDQeVKWdpPKtX7gwZA0-1768225596-1.0.1.1-388iOYGgZ.vH7na_bggKIU9AkfJNuigLqKWp.1uJT530AwfFEjVymz5pFh6N.bSngxhZT_q5g5_NT5SiC4gCqBl2TMdSal3zX7fxmATkQ60; \_cfuvid=ob0bGX2XZAAjtJcS_5KSFfDQUdpszXmS2tekJMF2i3Q-1768225628040-0.0.1.1-604800000; csrf_token_1d61ec8f0158ec4868343239ec73dbe1bfebad9908ad860e62f470c767573d0d=b5BBIlRkEawiStxGsPb59f4PDV2TTkPVWphUUP2Cc4s=; ory_session_coolcurranf83m3srkfl=MTc2ODIyNTY2NnxoSlF4dXpzSm9NZHFzRVpsemtJQkJoTERfQzBsR3Q1QnpGV2FyWHExd3JYX09qN2tLM2NlY2pyNG9Id2trNlBfd2g3VlEzS1VjdVdJNWRmNzR2Wk9GOGdtMzNZczVqMWdIQUJRSlBpNG9yVFE2RW1idWR6Q2xyQVNkVkNoU1JRWmRJUnZTUWJQdEJPYUkzUDduZ1c0WkowekRPSTRpWXRGenNLbzJaeEp6RlpCVXhtX1BHZ1E5dDhtOXNhaU9JVlJNMUZWR1YxNmlfdjk0blpJYm5uOE42V0drN2pCUXBQYjV0Y1dTelFRUkhVYTY4V19ZVFRyNDZJNEY0eGtvcmY3b1pDMDQxYXlGcThCVEg2RFJwemN8IOxk9IG_LclNE3UyF6KIKtyfGGYMcfWXVRaDoXkVtrY="
},
"response": {
"date": "Mon, 12 Jan 2026 13:47:49 GMT",
"content-type": "application/json; charset=utf-8",
"transfer-encoding": "chunked",
"connection": "keep-alive",
"mistral-correlation-id": "019bb276-7f70-7074-97fd-dc8f42e7482f",
"x-kong-request-id": "019bb276-7f70-7074-97fd-dc8f42e7482f",
"x-frame-options": "DENY",
"vary": "Cookie, Accept-Language",
"content-language": "en",
"x-content-type-options": "nosniff",
"referrer-policy": "same-origin",
"cross-origin-opener-policy": "same-origin",
"set-cookie": [
"csrftoken=5p6wK3MgXzxcxaIgC9YdXPxfDAXDwODR; expires=Mon, 11 Jan 2027 13:47:49 GMT; Max-Age=31449600; Path=/; SameSite=Lax"
],
"x-envoy-upstream-service-time": "199",
"x-kong-upstream-latency": "200",
"x-kong-proxy-latency": "0",
"cf-cache-status": "DYNAMIC",
"strict-transport-security": "max-age=15552000; includeSubDomains; preload",
"server": "cloudflare",
"cf-ray": "9bcd1b9c0b59fd36-SIN"
}
}

{
"request": "",
"response": "{\"uuid\": \"c4b7dd41-0982-4b94-b2f2-0694eba0f5f6\", \"uuid_internal\": \"c4b7dd41-0982-4b94-b2f2-0694eba0f5f6\", \"first_name\": \"Thien\", \"last_name\": \"Bao\", \"name\": \"Thien Bao\", \"email\": \"thienbaovn2468@gmail.com\", \"role\": \"A\", \"organization\": {\"uuid\": \"5467bb4d-de65-49b4-836d-e14e723de99a\", \"name\": \"ThienBao\", \"raw_role\": \"A\", \"email_domain\": null, \"customer_uuid\": \"ee251271-89c5-42bf-a37f-f1736c9db33e\", \"org_tier\": \"B\", \"is_le_chat_pro\": false, \"active_chat_plan\": null, \"le_chat_partner\": null, \"active_code_plan\": null, \"active_api_plan\": null, \"custom_domains\": {\"admin\": null, \"api\": null, \"chat\": null, \"console\": null}, \"custom_domain\": null, \"custom_logo\": null, \"custom_logo_chat\": null, \"custom_brand_color\": null, \"custom_language\": null, \"internal\": false, \"role\": \"A\", \"role_properties\": null}, \"available_organizations\": [{\"uuid\": \"5467bb4d-de65-49b4-836d-e14e723de99a\", \"name\": \"ThienBao\", \"raw_role\": \"A\", \"email_domain\": null, \"customer_uuid\": \"ee251271-89c5-42bf-a37f-f1736c9db33e\", \"org_tier\": \"B\", \"is_le_chat_pro\": false, \"active_chat_plan\": null, \"le_chat_partner\": null, \"active_code_plan\": null, \"active_api_plan\": null, \"custom_domains\": {\"admin\": null, \"api\": null, \"chat\": null, \"console\": null}, \"custom_domain\": null, \"custom_logo\": null, \"custom_logo_chat\": null, \"custom_brand_color\": null, \"custom_language\": null, \"internal\": false, \"role\": \"A\", \"role_properties\": null}], \"workspace\": {\"uuid\": \"d4e033a6-4363-40f9-973f-a55dc2394e7d\", \"name\": \"Default Workspace\", \"description\": \"This is the default workspace. It cannot be archived.\", \"icon\": \"\", \"members_count\": null, \"spend_limit\": null, \"is_default\": true, \"raw_role\": \"A\", \"role\": \"A\", \"role_properties\": null}, \"available_workspaces\": [{\"uuid\": \"d4e033a6-4363-40f9-973f-a55dc2394e7d\", \"name\": \"Default Workspace\", \"description\": \"This is the default workspace. It cannot be archived.\", \"icon\": \"\", \"members_count\": null, \"spend_limit\": null, \"is_default\": true}], \"customer\": {\"uuid\": \"ee251271-89c5-42bf-a37f-f1736c9db33e\", \"platform\": {\"api_tiers\": \"P\"}, \"is_no_log_customer\": false}, \"phone_hash\": null, \"feature_enabled\": {\"api_key.creation\": true}, \"language_preference\": \"en\", \"permissions\": {}}"
}

3/ POST https://console.mistral.ai/api-ui/event
{
"request": {
"host": "console.mistral.ai",
"connection": "keep-alive",
"content-length": "3342",
"sec-ch-ua": "\"Not*A Brand\";v=\"8\", \"Chromium\";v=\"120\"",
"content-type": "application/json",
"sec-ch-ua-mobile": "?0",
"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
"sec-ch-ua-platform": "\"Linux\"",
"accept": "*/\_",
"sec-fetch-site": "same-origin",
"sec-fetch-mode": "cors",
"sec-fetch-dest": "empty",
"referer": "https://console.mistral.ai/build/playground",
"accept-encoding": "gzip, deflate, br",
"accept-language": "en-US",
"cookie": "**cflb=0H28vBt3Asif1pksrBB47e5ijRcsvN5X5q49HEah1xY; csrftoken=5p6wK3MgXzxcxaIgC9YdXPxfDAXDwODR; **cf_bm=N0HWW0b2vqlACNWzHQb0BQHeJDQeVKWdpPKtX7gwZA0-1768225596-1.0.1.1-388iOYGgZ.vH7na_bggKIU9AkfJNuigLqKWp.1uJT530AwfFEjVymz5pFh6N.bSngxhZT_q5g5_NT5SiC4gCqBl2TMdSal3zX7fxmATkQ60; \_cfuvid=ob0bGX2XZAAjtJcS_5KSFfDQUdpszXmS2tekJMF2i3Q-1768225628040-0.0.1.1-604800000; csrf_token_1d61ec8f0158ec4868343239ec73dbe1bfebad9908ad860e62f470c767573d0d=b5BBIlRkEawiStxGsPb59f4PDV2TTkPVWphUUP2Cc4s=; ory_session_coolcurranf83m3srkfl=MTc2ODIyNTY2NnxoSlF4dXpzSm9NZHFzRVpsemtJQkJoTERfQzBsR3Q1QnpGV2FyWHExd3JYX09qN2tLM2NlY2pyNG9Id2trNlBfd2g3VlEzS1VjdVdJNWRmNzR2Wk9GOGdtMzNZczVqMWdIQUJRSlBpNG9yVFE2RW1idWR6Q2xyQVNkVkNoU1JRWmRJUnZTUWJQdEJPYUkzUDduZ1c0WkowekRPSTRpWXRGenNLbzJaeEp6RlpCVXhtX1BHZ1E5dDhtOXNhaU9JVlJNMUZWR1YxNmlfdjk0blpJYm5uOE42V0drN2pCUXBQYjV0Y1dTelFRUkhVYTY4V19ZVFRyNDZJNEY0eGtvcmY3b1pDMDQxYXlGcThCVEg2RFJwemN8IOxk9IG_LclNE3UyF6KIKtyfGGYMcfWXVRaDoXkVtrY="
},
"response": {
"date": "Mon, 12 Jan 2026 13:47:48 GMT",
"content-type": "application/json",
"transfer-encoding": "chunked",
"connection": "keep-alive",
"mistral-correlation-id": "019bb276-7ecc-74b9-b8a5-2c48593a44ac",
"x-kong-request-id": "019bb276-7ecc-74b9-b8a5-2c48593a44ac",
"vary": "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch",
"x-envoy-upstream-service-time": "12",
"x-kong-upstream-latency": "12",
"x-kong-proxy-latency": "2",
"cf-cache-status": "DYNAMIC",
"strict-transport-security": "max-age=15552000; includeSubDomains; preload",
"x-content-type-options": "nosniff",
"server": "cloudflare",
"cf-ray": "9bcd1b9d3bf98de9-SIN"
}
}

{
"request": "{\"name\":\"page_view\",\"properties\":{\"url\":\"https://console.mistral.ai/build/playground\"},\"user\":{\"uuid\":\"c4b7dd41-0982-4b94-b2f2-0694eba0f5f6\",\"uuid_internal\":\"c4b7dd41-0982-4b94-b2f2-0694eba0f5f6\",\"first_name\":\"Thien\",\"last_name\":\"Bao\",\"name\":\"Thien Bao\",\"email\":\"thienbaovn2468@gmail.com\",\"organization\":{\"uuid\":\"5467bb4d-de65-49b4-836d-e14e723de99a\",\"name\":\"ThienBao\",\"role\":\"A\",\"customer_uuid\":\"ee251271-89c5-42bf-a37f-f1736c9db33e\",\"email_domain\":null,\"org_tier\":\"B\",\"is_le_chat_pro\":false,\"active_chat_plan\":null,\"le_chat_partner\":null,\"active_code_plan\":null,\"active_api_plan\":null,\"custom_domains\":{\"admin\":null,\"api\":null,\"chat\":null,\"console\":null},\"custom_logo\":null,\"custom_logo_chat\":null,\"custom_brand_color\":null,\"custom_language\":null,\"internal\":false},\"workspace\":{\"uuid\":\"d4e033a6-4363-40f9-973f-a55dc2394e7d\",\"name\":\"Default Workspace\",\"description\":\"This is the default workspace. It cannot be archived.\",\"icon\":\"\",\"is_default\":true,\"role\":\"A\",\"members_count\":null,\"spend_limit\":null,\"monthly_spend\":null},\"customer\":{\"uuid\":\"ee251271-89c5-42bf-a37f-f1736c9db33e\",\"platform\":{\"api_tiers\":\"P\"},\"is_no_log_customer\":false},\"permissions\":{\"access_lechat\":false,\"start_deepresearch\":false},\"phone_hash\":null,\"feature_enabled\":{\"api_key.creation\":true},\"language_preference\":\"en\",\"available_workspaces\":[{\"uuid\":\"d4e033a6-4363-40f9-973f-a55dc2394e7d\",\"name\":\"Default Workspace\",\"description\":\"This is the default workspace. It cannot be archived.\",\"icon\":\"\",\"is_default\":true,\"role\":\"A\",\"members_count\":null,\"spend_limit\":null,\"monthly_spend\":null}],\"featureFlags\":{\"docl\":false,\"docl_webpage\":true,\"feathers-mcgraw\":false,\"frankreynolds\":false,\"evoli\":false,\"batches_advanced\":false,\"datacapture\":false,\"classifiers\":true,\"march_madness\":true,\"spacework_limits\":true,\"spacework_permissions\":false,\"tulpar_exp_page\":false,\"doppelganger\":false,\"potion_magique\":false,\"ninja_charts\":false,\"magic_spells\":true,\"playground\":true,\"tako\":true,\"webimages\":false,\"libraries_usage\":true,\"secart\":false,\"edit_image\":true,\"je_cherche_encore\":true,\"document_library_ui_in_console\":false,\"in_app_purchase_ios\":true,\"in_app_purchase_android\":true,\"c_selection\":true,\"livres_de_batisseurs\":true,\"use_message_patch\":true,\"curiosity_cat\":true,\"regles_du_jeu\":true,\"what_about_it\":false,\"what_about_it_web\":false,\"careless_whisper\":false,\"il_etait_une_fois_dans_le_web\":false,\"bfl_beta\":false,\"mistral_medium_31_swag\":false,\"rich_responses\":false,\"unleash_the_pixels\":true,\"scooter\":false,\"dialogues_entre_croises\":true,\"cause_toujours\":true,\"model_rc\":false,\"text_model_rc\":false,\"vision_model_rc\":false,\"audio_model_rc\":false,\"cerebras_model_rc\":false,\"reasoning_model_rc\":true,\"who_am_i\":false,\"trobo\":true,\"trotrobo_connectors\":false,\"agent_k\":true,\"page_header_v2\":false,\"ai_studio_cmdk\":false,\"picky\":false,\"abraxas_ui\":false,\"abraxas_ui_timeline\":false,\"ocr_playground\":true,\"ocr_playground_show_json_schema_visual_output\":false,\"vibe_page\":true,\"snitch\":false,\"range_ta_chambre\":true,\"playground_capabilities\":false,\"playground_connections\":false,\"agents_switch\":true,\"noop_flag\":false,\"kitchen4\":\"scale\",\"caravaggio\":false,\"rosenquist\":false,\"step_by_step\":false,\"fake_steps\":true,\"input_v2\":false,\"boite_a_chat\":false,\"ask_le_chat\":true,\"vibe_introduction_modal\":false,\"connectopoly\":false,\"html_preview\":false,\"paws_and_spaces\":false}}}",
"response": "{\"eventName\":\"console.page_view\"}"
}

4/ POST https://chat.mistral.ai/api/trpc/message.newChat?batch=1
{
"request": {
"host": "chat.mistral.ai",
"connection": "keep-alive",
"content-length": "651",
"sec-ch-ua": "\"Not*A Brand\";v=\"8\", \"Chromium\";v=\"120\"",
"x-trpc-source": "nextjs-react",
"user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Systema/0.1.0 Chrome/120.0.6099.291 Electron/28.3.3 Safari/537.36",
"sec-ch-ua-mobile": "?0",
"content-type": "application/json",
"trpc-accept": "application/jsonl",
"sec-ch-ua-platform": "\"Linux\"",
"accept": "*/\_",
"origin": "https://chat.mistral.ai",
"sec-fetch-site": "same-origin",
"sec-fetch-mode": "cors",
"sec-fetch-dest": "empty",
"referer": "https://chat.mistral.ai/chat",
"accept-encoding": "gzip, deflate, br",
"accept-language": "en-US",
"cookie": "anonymousUser=969cf496-195d-470c-8714-bc7993a05fe5; csrf_token_1d61ec8f0158ec4868343239ec73dbe1bfebad9908ad860e62f470c767573d0d=b5BBIlRkEawiStxGsPb59f4PDV2TTkPVWphUUP2Cc4s=; ory_session_coolcurranf83m3srkfl=MTc2ODIyNTY2NnxoSlF4dXpzSm9NZHFzRVpsemtJQkJoTERfQzBsR3Q1QnpGV2FyWHExd3JYX09qN2tLM2NlY2pyNG9Id2trNlBfd2g3VlEzS1VjdVdJNWRmNzR2Wk9GOGdtMzNZczVqMWdIQUJRSlBpNG9yVFE2RW1idWR6Q2xyQVNkVkNoU1JRWmRJUnZTUWJQdEJPYUkzUDduZ1c0WkowekRPSTRpWXRGenNLbzJaeEp6RlpCVXhtX1BHZ1E5dDhtOXNhaU9JVlJNMUZWR1YxNmlfdjk0blpJYm5uOE42V0drN2pCUXBQYjV0Y1dTelFRUkhVYTY4V19ZVFRyNDZJNEY0eGtvcmY3b1pDMDQxYXlGcThCVEg2RFJwemN8IOxk9IG_LclNE3UyF6KIKtyfGGYMcfWXVRaDoXkVtrY=; csrftoken=yaiu0U4gVhLtgsP4ByutxxGxlIgwiVu7; \_\_cf_bm=h7PScQHXFp9c2CbVNnTlq95RKZYbM6Yq0Rx4uosJOBw-1768225914-1.0.1.1-\_rmIJ3EgSLqQnn1EHsxzLwPy.R0o1_nkZHJpurGgc2FMyqGuOVjV.Lw4DAJ45K9UvgNCroAfxhBYsXUVyRLbtEmQBiPjM4a2LDgEBSfjJWc; \_cfuvid=60pS4ae3TJK6UkBOFXchJ5S6Ju2EXGJJfmOMG.WnqWs-1768225914913-0.0.1.1-604800000"
},
"response": {
"date": "Mon, 12 Jan 2026 13:52:10 GMT",
"content-type": "application/json",
"transfer-encoding": "chunked",
"connection": "keep-alive",
"mistral-correlation-id": "019bb27a-7a4b-7acf-a979-8259ce29260f",
"x-kong-request-id": "019bb27a-7a4b-7acf-a979-8259ce29260f",
"x-frame-options": "DENY",
"x-content-type-options": "nosniff",
"referrer-policy": "origin-when-cross-origin",
"vary": "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch,trpc-accept, Origin",
"x-envoy-upstream-service-time": "117",
"access-control-allow-credentials": "true",
"x-kong-upstream-latency": "117",
"x-kong-proxy-latency": "1",
"cf-cache-status": "DYNAMIC",
"strict-transport-security": "max-age=15552000; includeSubDomains; preload",
"server": "cloudflare",
"cf-ray": "9bcd21fc9ebffcff-SIN",
"alt-svc": "h3=\":443\"; ma=86400"
}
}

{
"request": "{\"0\":{\"json\":{\"content\":[{\"type\":\"text\",\"text\":\"xin chào bạn\"}],\"voiceInput\":null,\"audioRecording\":null,\"agentId\":null,\"agentsApiAgentId\":null,\"files\":[],\"isSampleChatForAgentId\":null,\"model\":null,\"features\":[\"beta-code-interpreter\",\"beta-imagegen\",\"beta-websearch\",\"beta-reasoning\"],\"integrations\":[],\"canva\":null,\"action\":null,\"libraries\":[],\"projectId\":null,\"incognito\":false},\"meta\":{\"values\":{\"voiceInput\":[\"undefined\"],\"audioRecording\":[\"undefined\"],\"agentId\":[\"undefined\"],\"agentsApiAgentId\":[\"undefined\"],\"isSampleChatForAgentId\":[\"undefined\"],\"model\":[\"undefined\"],\"canva\":[\"undefined\"],\"action\":[\"undefined\"],\"projectId\":[\"undefined\"]}}}}",
"response": "{\"json\":{\"0\":[[0],[null,0,0]]}}\n{\"json\":[0,0,[[{\"result\":0}],[\"result\",0,1]]]}\n{\"json\":[1,0,[[{\"data\":0}],[\"data\",0,2]]]}\n{\"json\":[2,0,[[{\"messages\":{\"role\":\"user\",\"content\":\"xin chào bạn\",\"contentChunks\":null,\"turn\":0,\"createdAt\":\"2026-01-12T13:52:09.984Z\",\"agentId\":null,\"agentsApiAgentId\":null,\"chatId\":\"2d8cd768-0adc-4a23-ae5e-42ffe31ec557\",\"createdById\":\"c4b7dd41-0982-4b94-b2f2-0694eba0f5f6\",\"id\":\"d2815121-a8b6-45bf-9f28-1b3b37432fb6\",\"isAcceleratedAnswer\":false,\"moderationCategory\":null,\"reaction\":\"neutral\",\"references\":null,\"memories\":null,\"followups\":[],\"status\":\"active\",\"generationStatus\":\"success\",\"parentId\":null,\"parentVersion\":null,\"model\":null,\"visibility\":\"private\",\"version\":0,\"prevVersion\":null,\"nextVersion\":null,\"versionCount\":1,\"files\":[],\"canvas\":[],\"quotedContent\":null,\"workflowExecution\":null},\"chatId\":\"2d8cd768-0adc-4a23-ae5e-42ffe31ec557\"}]]],\"meta\":{\"values\":{\"2.0.0.messages.createdAt\":[\"Date\"]}}}\n"
}

5/ POST https://chat.mistral.ai/api/chat
{
"request": {
"host": "chat.mistral.ai",
"connection": "keep-alive",
"content-length": "312",
"sec-ch-ua": "\"Not*A Brand\";v=\"8\", \"Chromium\";v=\"120\"",
"content-type": "application/json",
"sec-ch-ua-mobile": "?0",
"user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Systema/0.1.0 Chrome/120.0.6099.291 Electron/28.3.3 Safari/537.36",
"sec-ch-ua-platform": "\"Linux\"",
"accept": "*/\_",
"origin": "https://chat.mistral.ai",
"sec-fetch-site": "same-origin",
"sec-fetch-mode": "cors",
"sec-fetch-dest": "empty",
"referer": "https://chat.mistral.ai/chat/66b987d8-ee25-44ca-8ced-47b324960cb1",
"accept-encoding": "gzip, deflate, br",
"accept-language": "en-US",
"cookie": "anonymousUser=969cf496-195d-470c-8714-bc7993a05fe5; csrf_token_1d61ec8f0158ec4868343239ec73dbe1bfebad9908ad860e62f470c767573d0d=b5BBIlRkEawiStxGsPb59f4PDV2TTkPVWphUUP2Cc4s=; ory_session_coolcurranf83m3srkfl=MTc2ODIyNTY2NnxoSlF4dXpzSm9NZHFzRVpsemtJQkJoTERfQzBsR3Q1QnpGV2FyWHExd3JYX09qN2tLM2NlY2pyNG9Id2trNlBfd2g3VlEzS1VjdVdJNWRmNzR2Wk9GOGdtMzNZczVqMWdIQUJRSlBpNG9yVFE2RW1idWR6Q2xyQVNkVkNoU1JRWmRJUnZTUWJQdEJPYUkzUDduZ1c0WkowekRPSTRpWXRGenNLbzJaeEp6RlpCVXhtX1BHZ1E5dDhtOXNhaU9JVlJNMUZWR1YxNmlfdjk0blpJYm5uOE42V0drN2pCUXBQYjV0Y1dTelFRUkhVYTY4V19ZVFRyNDZJNEY0eGtvcmY3b1pDMDQxYXlGcThCVEg2RFJwemN8IOxk9IG_LclNE3UyF6KIKtyfGGYMcfWXVRaDoXkVtrY=; csrftoken=uu76QadWVqqy2k0hIyC5jSd640NmDUCo; \_\_cf_bm=kqrv9aVSuZp9EsLaSs0RzlTEtf9JeuRDCUco2l2rAbs-1768226059-1.0.1.1-bFKIhp0Cr0CYw0wwEzb_sK6KwUTzVOC3NJM.p61y2LjASz7zom0V9EwalhHNIlhfk.CpUnqsYwhmpsM79Z0J_x6nw6uJndXk2lRCoXeAtyE; \_cfuvid=YEN6zFTLw8vn726eX79ESwBHnMudaJmBjHD5RWPiMus-1768226059609-0.0.1.1-604800000"
},
"response": {
"date": "Mon, 12 Jan 2026 13:54:30 GMT",
"content-type": "text/event-stream",
"transfer-encoding": "chunked",
"connection": "keep-alive",
"mistral-correlation-id": "019bb27c-9894-709e-a884-efbb7dc6171e",
"x-kong-request-id": "019bb27c-9894-709e-a884-efbb7dc6171e",
"x-frame-options": "DENY",
"x-content-type-options": "nosniff",
"referrer-policy": "origin-when-cross-origin",
"vary": "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Origin",
"cache-control": "no-cache",
"x-envoy-upstream-service-time": "1431",
"access-control-allow-credentials": "true",
"x-kong-upstream-latency": "1432",
"x-kong-proxy-latency": "0",
"cf-cache-status": "DYNAMIC",
"strict-transport-security": "max-age=15552000; includeSubDomains; preload",
"server": "cloudflare",
"cf-ray": "9bcd25603ee9a8f8-SIN",
"alt-svc": "h3=\":443\"; ma=86400"
}
}

{
"request": "{\"chatId\":\"66b987d8-ee25-44ca-8ced-47b324960cb1\",\"mode\":\"start\",\"disabledFeatures\":[],\"clientPromptData\":{\"currentDate\":\"2026-01-12\",\"userTimezone\":\"T+07:00 (Asia/Saigon)\"},\"stableAnonymousIdentifier\":\"79zqlm\",\"shouldAwaitStreamBackgroundTasks\":true,\"shouldUseMessagePatch\":true,\"shouldUsePersistentStream\":true}",
"response": "16:{\"json\":{\"disclaimers\":[]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"replace\",\"path\":\"/\",\"value\":{\"role\":\"assistant\",\"content\":\"\",\"contentChunks\":null,\"turn\":0,\"createdAt\":\"2026-01-12T13:54:30.048Z\",\"agentId\":null,\"agentsApiAgentId\":null,\"chatId\":\"66b987d8-ee25-44ca-8ced-47b324960cb1\",\"createdById\":\"c4b7dd41-0982-4b94-b2f2-0694eba0f5f6\",\"files\":[],\"id\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"isAcceleratedAnswer\":true,\"moderationCategory\":null,\"reaction\":\"neutral\",\"references\":null,\"memories\":null,\"followups\":[],\"status\":\"active\",\"generationStatus\":\"in-progress\",\"parentId\":\"fb273b61-b68f-4736-83d2-5fc564fe55ff\",\"parentVersion\":0,\"version\":0,\"nextVersion\":null,\"prevVersion\":null,\"versionCount\":1,\"visibility\":\"private\",\"model\":null,\"quotedContent\":null,\"workflowExecution\":null}}]},\"meta\":{\"values\":{\"patches.0.value.createdAt\":[\"Date\"]}}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"replace\",\"path\":\"/references\",\"value\":[]}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"replace\",\"path\":\"/contentChunks\",\"value\":[{\"type\":\"text\",\"text\":\"Okay, the user\",\"_context\":{\"type\":\"reasoning\",\"contextId\":\"f9f41129-1684-47d2-9dee-fe8065abcdad\",\"startTime\":1768226070058,\"endTime\":1768226070058}}]}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/0/text\",\"value\":\" is greeting me in Vietnamese.\"},{\"op\":\"replace\",\"path\":\"/contentChunks/0/_context\",\"value\":{\"type\":\"reasoning\",\"contextId\":\"f9f41129-1684-47d2-9dee-fe8065abcdad\",\"startTime\":1768226070058,\"endTime\":1768226070059}}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/0/text\",\"value\":\" I should respond in Vietnamese to be polite\"},{\"op\":\"replace\",\"path\":\"/contentChunks/0/_context\",\"value\":{\"type\":\"reasoning\",\"contextId\":\"f9f41129-1684-47d2-9dee-fe8065abcdad\",\"startTime\":1768226070058,\"endTime\":1768226070061}}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/0/text\",\"value\":\" and match their\"},{\"op\":\"replace\",\"path\":\"/contentChunks/0/_context\",\"value\":{\"type\":\"reasoning\",\"contextId\":\"f9f41129-1684-47d2-9dee-fe8065abcdad\",\"startTime\":1768226070058,\"endTime\":1768226070076}}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/0/text\",\"value\":\" language choice.\"},{\"op\":\"replace\",\"path\":\"/contentChunks/0/_context\",\"value\":{\"type\":\"reasoning\",\"contextId\":\"f9f41129-1684-47d2-9dee-fe8065abcdad\",\"startTime\":1768226070058,\"endTime\":1768226070077}}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"add\",\"path\":\"/contentChunks/1\",\"value\":{\"type\":\"text\",\"text\":\"Xin\",\"_context\":null}}]},\"meta\":{\"values\":{\"patches.0.value.\_context\":[\"undefined\"]}}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/1/text\",\"value\":\" ch\"}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/1/text\",\"value\":\"ào Th\"}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/1/text\",\"value\":\"ien Bao! T\"}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/1/text\",\"value\":\"ôi có thể giúp gì\"}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/1/text\",\"value\":\" cho bạn hôm nay\"}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"append\",\"path\":\"/contentChunks/1/text\",\"value\":\"?\"}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"fb273b61-b68f-4736-83d2-5fc564fe55ff\",\"messageVersion\":0,\"patches\":[{\"op\":\"replace\",\"path\":\"/moderationCategory\",\"value\":\"safe\"}]}}\n15:{\"json\":{\"type\":\"message\",\"messageId\":\"3d3ab56d-4cb4-42cb-9b52-974821eef531\",\"messageVersion\":0,\"patches\":[{\"op\":\"replace\",\"path\":\"/generationStatus\",\"value\":\"success\"}]}}\n8:null\n"
}
