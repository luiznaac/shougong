---
source: research brief — which OpenCode Go models fit vocabulary-constrained Mandarin reading generation
branch: research/reading-model-selection
date: 2026-11-13
---

# Reading generation: model choice within OpenCode Go

## The workload

`POST /reading-texts` asks a model for a short Mandarin text built almost entirely from a supplied known-word list (HSK-based working set). The request (`backend/src/shougong/gateway/reading/litellm_reading_gateway.py`):

- system prompt + a JSON working set, ~1.7k prompt tokens on live requests;
- one forced tool call (`tool_choice` = named function `return_reading_text` with a JSON schema);
- `max_tokens: 16000`, `reasoning_effort: low`;
- non-streaming, through an OpenAI Chat Completions client (`{base_url}/chat/completions`).

The service accepts a draft only when it has at most `max_extra_words` (default 2) out-of-vocabulary words; otherwise it retries up to `max_attempts` (default 3). Constraint adherence is the hard requirement; latency is second, but a single attempt currently costs 86–246 s.

## Measured baseline (incumbent: `deepseek-v4.1-flash` via OpenCode Go)

LiteLLM request records (`/spend/logs/v2`, key `d9c60c5f…`) for the app's calls, and direct probes through `LiteLlmReadingGateway` with a fixed ~140-word working set:

| effort | duration | out-of-vocabulary (budget 2) | completion tokens | reasoning tokens |
|---|---|---|---|---|
| `low` (live) | 86–246 s | within budget | 5.3k–13.3k | 5.2k–13.2k |
| `minimal` | 15–33 s | 9–20 | 2.4k–5.8k | — |
| `none` | 3.5–3.9 s | 29–40 | 114–148 | 0 |

Latency is almost entirely reasoning tokens: the prompt is tiny, and the same reasoning volume varied from 95 s to 246 s across requests (provider-side variance). Dropping effort is not an option — the vocabulary ceiling collapses. The model must be *allowed* to think; the lever is how efficiently it does so at `reasoning_effort: low`, and how well it follows the constraint per reasoning token.

## Candidates (OpenCode Go catalog)

Metadata from the models.dev registry (`opencode-go` provider); pricing/limits and endpoints from the Go docs.

| model | Go endpoint family | effort control | ctx / out | input/output $/MTok | Go monthly limit | notes |
|---|---|---|---|---|---|---|
| `glm-5.3-flash` | OpenAI Chat Completions | `reasoning_effort` `low`/`high`/`max`, thinking always on | 1M / 128k | 0.15 / 0.50 | $60 (~31.5k req) | Zhipu; open weights; 320B total/18B active; function calling + structured output; FlashX variant ~200 tok/s |
| `deepseek-v4.1-flash` | OpenAI Chat Completions | `thinking` + `reasoning_effort` | 1M / 384k | 0.15 / 0.60 (peak 0.30 / 1.20) | $100 (~216k req) | incumbent; proven on this task; ZDR agreement through 2026-11-30 |
| `kimi-k3.1-pro` | OpenAI Chat Completions (also Anthropic Messages) | `reasoning_effort` `low`/`high`/`max`, default `max` | 1M / 131k | 2.00 / 10.00 | $15 (~735 req) | Moonshot; docs position it as strong in Chinese and English; expensive per token |
| `minimax-m3.1-flash` | OpenAI Chat Completions | not documented on the pages fetched | 1M / 512k | 0.15 / 0.60 | $20 (~19k req) | 200+ tok/s claim, ~3× M3; vendor material is agent/coding-focused |
| `qwen3.8-flash` | Anthropic Messages (via Go) | not verified | 1M / 131k | 0.15 / 0.47 | $30 (~27k req) | Alibaba; structured output; native endpoint is Anthropic — translation risk for `tool_choice`/`reasoning_effort` |
| `mimo-v2.6-flash` | OpenAI Chat Completions | not verified | 1M / 131k | 0.14 / 0.28 | $60 (~150k req) | Xiaomi; cheapest output; no Chinese evidence on the pages fetched |
| `claude-haiku-5-5` | Anthropic Messages | adaptive thinking, effort parameter (default `medium`) | 1M / 128k | 0.10 / 0.50 | $15 (~19k req) | strongest instruction/tool discipline of the cheap tier; Anthropic-native → translation risk |
| `gpt-6-luna` | OpenAI Responses | OpenAI reasoning effort (`reasoning.effort`) | 1.05M / 128k | 0.10 / 0.50 | $15 (~21k req) | Responses API, not Chat Completions → translation risk |
| `longcat-2.5-free`, `beam-free`, `iceman-contributor-free` | OpenAI Chat Completions | — | 1M / 131k–262k | 0 | unlimited | avoid for this app: free-tier chat models are OpenCode-client-only (403 elsewhere), LongCat is hosted in China and needs Global regions, Iceman trains on request data |

`glm-5.3` (non-flash) has the same effort control but costs $1.40/$4.40 with a $15 monthly limit; `kimi-k3` is $3/$15 with $15. Both are dominated by their flash/pro alternatives for this workload.

## Recommendation

1. **`glm-5.3-flash` — best swap candidate.** It is the only cheap Chinese-lab model whose documented control surface matches the app exactly: OpenAI Chat Completions, forced tool calling, structured output, and `reasoning_effort: low` as a first-class value (GLM-5.3/Flash "text parameters are consistent"). Its `low` is the floor (thinking cannot be disabled), which is the same shape as the incumbent's `low` that already meets the OOV budget. Highest Go request allowance among the cheap models ($60) and the lowest per-token cost of the credible candidates.
2. **`deepseek-v4.1-flash` — keep as the default until a candidate is measured on the task.** It is the only model with evidence that it meets the OOV budget, and it has the largest monthly limit ($100). Its weakness is latency variance, not correctness.
3. **`kimi-k3.1-pro` — quality ceiling, cost floor.** Documented Chinese/English strength and the same `low`/`high`/`max` knob, but $2/$10 with a $15 monthly limit (~735 requests/month) makes it a control/comparison model, not the everyday one.
4. **`minimax-m3.1-flash` — the speed play.** Fastest documented output (200+ tok/s) at the same price as GLM-Flash, but its reasoning control is undocumented and its published evidence is coding/agentic, so it needs the same measurement before it can replace the incumbent.
5. **`qwen3.8-flash` — the Chinese-native wildcard.** Strongest vendor fit for Mandarin, but it is served on the Anthropic Messages family; the app's OpenAI-style `tool_choice` and top-level `reasoning_effort` have to survive Console translation, which the docs describe inconsistently ("every text model also works through the other APIs, which Console translates" vs "Each model is served by one API family"). Test before trusting.
6. **`claude-haiku-5-5` / `gpt-6-luna` — adherence controls.** Both are cheap and disciplined, but they are Anthropic/Responses-native (translation risk) and have no documented Chinese advantage; useful as a "did the model follow the vocabulary?" ceiling, not as the default.

## Operational caveats

- **Off-label use.** The Go docs say the plan is "designed for OpenCode and other coding agents", with abuse monitoring and a request that clients send `x-opencode-session`. A reading generator is not coding traffic; treat Go as a development convenience, and move to OpenCode Zen (pay-as-you-go) or a direct provider key if this becomes a public service.
- **Free-tier models are not usable from this app**: "Free-tier chat models are only available from within OpenCode; other clients receive HTTP 403, even with an API key."
- **Limits are dollar-based**: 5-hour = 20% of the monthly limit, weekly = 50%, monthly = 100%. A 246 s generation with 13k output tokens costs roughly $0.008 at DeepSeek's off-peak price, so the $100 limit is ~200k requests — ample for personal use.
- **Privacy**: DeepSeek's ZDR agreement is renewed monthly (valid through 2026-11-30); LongCat 2.5 Free is hosted in China; Muse Spark/Iceman Contributor train on prompts and completions.

## Test plan

The decision must be made on this task, not on coding benchmarks. The probe is a direct `LiteLlmReadingGateway` call: a fixed working set, `reasoning_effort="low"`, `max_tokens=16000`, and the forced tool call, run three times per candidate.

1. In LiteLLM, add one alias per candidate pointing at `https://opencode.ai/inference/go/openai/v1` with the candidate's model id (the incumbent alias uses the same base). For Qwen, try the OpenAI-compatible path first and fall back to `https://opencode.ai/inference/go/anthropic/v1/messages`; record whether forced `tool_choice` and `reasoning_effort` are honoured.
2. For each candidate, measure: wall-clock duration, `completion_tokens` (reasoning included), out-of-vocabulary count via `shougong.usecase.reading.validation.out_of_vocabulary` over `JiebaSegmenter`, and whether the tool call parsed (`ReadingDraft.text` non-empty).
3. Accept a candidate only if ≥2 of 3 runs meet the OOV budget; among those, rank by p50 duration, then by Go monthly limit.
4. Re-run the winning candidate with the app's real working set (via `POST /reading-texts`) before switching `GATEWAYS__AI__BASE_URL`/model in the reading screen.

## Sources (primary)

- OpenCode Go plan, model list, pricing, limits, endpoints, privacy: https://opencode.ai/v2/docs/console/go/
- OpenCode inference API families, auth, free-tier restriction, cost/usage fields: https://opencode.ai/v2/docs/console/api/inference
- Model metadata (context, output, reasoning, tool calling, cost): https://models.dev/api.json (provider `opencode-go`)
- GLM-5.3 reasoning control (`thinking.type`, `reasoning_effort` `low`/`high`/`max`): https://docs.z.ai/guides/llm/glm-5.3
- GLM-5.3-Flash parameters, function calling, structured output, speed: https://docs.z.ai/guides/llm/glm-5.3-flash
- DeepSeek API (`thinking`, `reasoning_effort`, `deepseek-flash` = V4.1-Flash-1017): https://api-docs.deepseek.com/ and https://api-docs.deepseek.com/guides/reasoning_model
- Kimi K3.1 Pro `reasoning_effort` `low`/`high`/`max` and bilingual positioning: https://platform.kimi.ai/docs/guide/choose-model
- MiniMax M3.1 Flash release (throughput, pricing): https://www.minimax.cn/blog/minimax-m31f
- Claude Haiku 5.5 capabilities and adaptive thinking/effort: https://platform.claude.com/docs/en/models/overview

## Community sources

None. Every claim above is from a first-party source or from measurements taken against the deployment.
