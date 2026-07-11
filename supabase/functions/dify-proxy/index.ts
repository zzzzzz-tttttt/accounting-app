// Supabase Edge Function：Dify API 代理
// 前端不直接持有 Dify Key，通过此函数中转

const DIFY_URL = "https://api.dify.ai/v1"

// 从 Supabase 环境变量读取（Dashboard → Edge Functions → Secrets）
const KEYS = {
  accounting: Deno.env.get("DIFY_ACCOUNTING_KEY") || "",
  correction: Deno.env.get("DIFY_CORRECTION_KEY") || "",
  stats: Deno.env.get("DIFY_STATS_KEY") || "",
}

// ===== 辅助函数 =====

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  })
}

async function difyUploadFile(base64: string, filename: string, apiKey: string): Promise<string> {
  const binStr = atob(base64)
  const bytes = new Uint8Array(binStr.length)
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i)
  }

  const form = new FormData()
  form.append("file", new Blob([bytes]), filename || "receipt.png")
  form.append("user", "accounting-app")

  const res = await fetch(`${DIFY_URL}/files/upload`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`文件上传失败 ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.id as string
}

// ===== 主函数 =====

export default {
  async fetch(req: Request): Promise<Response> {
    // CORS 预检
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() })
    }

    try {
      const { action, ...params } = await req.json()

      // --- OCR：图片识别 ---
      if (action === "ocr") {
        if (!KEYS.accounting) return json({ ok: false, error: "未配置 DIFY_ACCOUNTING_KEY" }, 500)
        if (!params.image) return json({ ok: false, error: "未收到图片数据" }, 400)

        const fileId = await difyUploadFile(params.image, params.filename || "receipt.png", KEYS.accounting)

        const wfRes = await fetch(`${DIFY_URL}/workflows/run`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${KEYS.accounting}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: {
              text_input: "",
              audio_file: null,
              image_file: {
                transfer_method: "local_file",
                upload_file_id: fileId,
                type: "image",
              },
            },
            response_mode: "blocking",
            user: "accounting-app",
          }),
        })

        return json(await wfRes.json())
      }

      // --- 文字解析 ---
      if (action === "parse") {
        if (!KEYS.accounting) return json({ ok: false, error: "未配置 DIFY_ACCOUNTING_KEY" }, 500)

        const res = await fetch(`${DIFY_URL}/workflows/run`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${KEYS.accounting}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: {
              text_input: params.text || "",
              audio_file: null,
              image_file: null,
            },
            response_mode: "blocking",
            user: "accounting-app",
          }),
        })

        return json(await res.json())
      }

      // --- 纠错对话 ---
      if (action === "chat") {
        const key = KEYS.correction || KEYS.accounting
        if (!key) return json({ ok: false, error: "未配置纠错 Key" }, 500)

        const chatBody: Record<string, unknown> = {
          inputs: {},
          query: params.query,
          response_mode: "blocking",
          user: "accounting-app",
        }
        if (params.conversation_id) chatBody.conversation_id = params.conversation_id

        const res = await fetch(`${DIFY_URL}/chat-messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chatBody),
        })

        return json(await res.json())
      }

      // --- 统计分析 ---
      if (action === "stats") {
        const key = KEYS.stats || KEYS.accounting
        if (!key) return json({ ok: false, error: "未配置统计 Key" }, 500)

        const res = await fetch(`${DIFY_URL}/workflows/run`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: {
              transactions_json: params.transactions_json || "[]",
              start_date: params.start_date || "",
              end_date: params.end_date || "",
            },
            response_mode: "blocking",
            user: "accounting-app",
          }),
        })

        return json(await res.json())
      }

      return json({ ok: false, error: `未知 action: ${action}` }, 400)

    } catch (err) {
      return json(
        { ok: false, error: err instanceof Error ? err.message : "代理请求失败" },
        500
      )
    }
  },
}
