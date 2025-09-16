const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: "cloud1-1grapwhzb010af67" })

// 你的 Token 和 Agent ID（直接写死）
const API_KEY = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJhdWQiOiJjbG91ZDEtMWdyYXB3aHpiMDEwYWY2NyIsImV4cCI6MjUzNDAyMzAwNzk5LCJpYXQiOjE3NTc3NTU1NDksImF0X2hhc2giOiJvbzJicXBDREVmQ21wVkpVQUc1VTZRIiwicHJvamVjdF9pZCI6ImNsb3VkMS0xZ3JhcHdoemIwMTBhZjY3IiwibWV0YSI6eyJwbGF0Zm9ybSI6IkFwaUtleSJ9LCJhZG1pbmlzdHJhdG9yX2lkIjoiMTk2MjM4OTIyMDQxNDc0MjUyOSIsInVzZXJfdHlwZSI6IiJ9.WAJsj4FV42O9uX6uDl1-nL00KGQphePkI4u7fv0kFih6sPfYEsQfIQu8-XemOVTnDp_dn8qXVzIG-eW7Aa5HpOowkt9OKlK0WxWPi4SyP-XpJ2pEf6dI7swu09_gdboT7s26LsvVlFW8z8xMOSZLN8u0jYiV4Axdcuhwvqa6GeWSbO-ryekHNk2e6JS_F955uHInEbzkZVRyezaw-5ZPWBL8tG8NtrY89HaU0YEFMeq9-16aZIxHJ9EQOLDQSv3-yjupwAHmSrTQBKxZaSUo9xpTPMIF6UxD0LyR1pXCxXedNbootcoxE_ENZDxReWQIzojcpPzIjXh7VAYysisfXQ"
const AGENT_ID = "ibot-20250913-l8ybhitor8"

// 云函数入口
exports.main = async (event, context) => {
  const { question } = event

  try {
    // AI Agent 的默认域名
    const url = "https://ibot-20250913-186544-9-1375656784.sh.run.tcloudbase.com/invoke"

    // 调用 AI Agent
    const res = await axios.post(
      url,
      {
        query: question,
        stream: false // 关闭流式，直接返回结果
      },
      {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "x-agent-id": AGENT_ID,
          "Content-Type": "application/json"
        }
      }
    )

    // 成功返回 AI 回复
    return res.data
  } catch (err) {
    console.error("调用 AI Agent 出错:", err)
    return { error: err.message }
  }
}
