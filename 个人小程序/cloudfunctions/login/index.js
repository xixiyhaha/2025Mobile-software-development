// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: "cloud1-1grapwhzb010af67" }) // 替换为你的云环境ID

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  }
}